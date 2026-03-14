use super::*;
use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{
    header::{AUTHORIZATION, CONTENT_TYPE},
    HeaderMap, HeaderName, Method, Request, StatusCode,
};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
struct HttpAppState {
    config: Arc<DaemonConfig>,
    daemon_state: Arc<DaemonState>,
    events: broadcast::Sender<DaemonEvent>,
}

pub(super) async fn serve(
    listener: TcpListener,
    config: Arc<DaemonConfig>,
    daemon_state: Arc<DaemonState>,
    events: broadcast::Sender<DaemonEvent>,
) -> Result<(), String> {
    let app = build_router(HttpAppState {
        config,
        daemon_state,
        events,
    });

    axum::serve(listener, app)
        .await
        .map_err(|err| format!("HTTP serve failed: {err}"))
}

fn build_router(state: HttpAppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/version", get(version))
        .route("/rpc", post(handle_http_rpc))
        .route("/rpc/ws", get(handle_websocket_upgrade))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                // Allow preflight requests to be handled by the CORS layer without relying on a
                // dedicated `OPTIONS` route.
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers([AUTHORIZATION, CONTENT_TYPE, HeaderName::from_static("x-codex-monitor-client-version")]),
        )
        .with_state(state)
}

async fn healthz() -> Json<Value> {
    Json(json!({ "ok": true }))
}

async fn version(State(state): State<HttpAppState>) -> Json<Value> {
    Json(json!({
        "name": DAEMON_NAME,
        "version": env!("CARGO_PKG_VERSION"),
        "httpEnabled": state.config.http_listen.is_some(),
        "httpListen": state.config.http_listen.map(|addr| addr.to_string()),
    }))
}

async fn handle_http_rpc(
    State(state): State<HttpAppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Response {
    let request_id = payload.get("id").and_then(Value::as_u64);
    if let Some(response) = reject_if_unauthorized(&state.config, &headers, request_id) {
        return response;
    }

    let Some(method) = payload.get("method").and_then(Value::as_str) else {
        return json_rpc_error_response(
            request_id,
            StatusCode::BAD_REQUEST,
            "missing or invalid `method`",
        );
    };
    let params = payload.get("params").cloned().unwrap_or(Value::Null);
    let client_version = request_client_version(&headers);

    match rpc::handle_rpc_request(&state.daemon_state, method, params, client_version).await {
        Ok(result) => json_rpc_result_response(request_id, result),
        Err(message) => json_rpc_error_response(request_id, StatusCode::BAD_REQUEST, &message),
    }
}

async fn handle_websocket_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<HttpAppState>,
) -> Response {
    ws.on_upgrade(move |socket| async move {
        handle_websocket(socket, state).await;
    })
}

async fn handle_websocket(socket: WebSocket, state: HttpAppState) {
    let (sender, mut receiver) = socket.split();
    let sender = Arc::new(Mutex::new(sender));
    let mut authenticated = state.config.token.is_none();
    let mut events_task = if authenticated {
        Some(spawn_event_forwarder(
            Arc::clone(&sender),
            state.events.subscribe(),
        ))
    } else {
        None
    };

    while let Some(message) = receiver.next().await {
        let Ok(message) = message else {
            break;
        };
        let Message::Text(text) = message else {
            continue;
        };

        let Ok(payload) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        let request_id = payload.get("id").and_then(Value::as_u64);
        let method = payload.get("method").and_then(Value::as_str).unwrap_or("");
        let params = payload.get("params").cloned().unwrap_or(Value::Null);

        if !authenticated {
            if method != "auth" {
                if send_ws_text(
                    &sender,
                    json_rpc_error_text(request_id, "unauthorized"),
                )
                .await
                .is_err()
                {
                    break;
                }
                break;
            }

            let expected = state.config.token.clone().unwrap_or_default();
            let provided = parse_auth_token(&params).unwrap_or_default();
            if expected != provided {
                if send_ws_text(
                    &sender,
                    json_rpc_error_text(request_id, "invalid token"),
                )
                .await
                .is_err()
                {
                    break;
                }
                break;
            }

            authenticated = true;
            if send_ws_text(
                &sender,
                json_rpc_result_text(request_id, json!({ "ok": true })),
            )
            .await
            .is_err()
            {
                break;
            }
            events_task = Some(spawn_event_forwarder(
                Arc::clone(&sender),
                state.events.subscribe(),
            ));
            continue;
        }

        let response = match rpc::handle_rpc_request(
            &state.daemon_state,
            method,
            params,
            "browser-ws".to_string(),
        )
        .await
        {
            Ok(result) => json_rpc_result_text(request_id, result),
            Err(message) => json_rpc_error_text(request_id, &message),
        };

        if send_ws_text(&sender, response).await.is_err() {
            break;
        }
    }

    if let Some(task) = events_task {
        task.abort();
    }
}

fn spawn_event_forwarder(
    sender: Arc<Mutex<futures_util::stream::SplitSink<WebSocket, Message>>>,
    mut rx: broadcast::Receiver<DaemonEvent>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            let event = match rx.recv().await {
                Ok(event) => event,
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            };
            let Some(payload) = event_notification_text(event) else {
                continue;
            };
            if send_ws_text(&sender, payload).await.is_err() {
                break;
            }
        }
    })
}

async fn send_ws_text(
    sender: &Arc<Mutex<futures_util::stream::SplitSink<WebSocket, Message>>>,
    payload: String,
) -> Result<(), ()> {
    sender
        .lock()
        .await
        .send(Message::Text(payload.into()))
        .await
        .map_err(|_| ())
}

fn event_notification_text(event: DaemonEvent) -> Option<String> {
    let payload = match event {
        DaemonEvent::AppServer(payload) => json!({
            "method": "app-server-event",
            "params": payload,
        }),
        DaemonEvent::TerminalOutput(payload) => json!({
            "method": "terminal-output",
            "params": payload,
        }),
        DaemonEvent::TerminalExit(payload) => json!({
            "method": "terminal-exit",
            "params": payload,
        }),
    };
    serde_json::to_string(&payload).ok()
}

fn parse_auth_token(params: &Value) -> Option<String> {
    match params {
        Value::String(value) => Some(value.clone()),
        Value::Object(map) => map
            .get("token")
            .and_then(Value::as_str)
            .map(str::to_string),
        _ => None,
    }
}

fn reject_if_unauthorized(
    config: &DaemonConfig,
    headers: &HeaderMap,
    request_id: Option<u64>,
) -> Option<Response> {
    let Some(expected_token) = config.token.as_deref() else {
        return None;
    };
    let provided = bearer_token(headers);
    if provided.as_deref() == Some(expected_token) {
        return None;
    }
    Some(json_rpc_error_response(
        request_id,
        StatusCode::UNAUTHORIZED,
        "unauthorized",
    ))
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(AUTHORIZATION)?.to_str().ok()?.trim();
    let token = raw.strip_prefix("Bearer ")?;
    let trimmed = token.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn request_client_version(headers: &HeaderMap) -> String {
    headers
        .get("x-codex-monitor-client-version")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("browser-http")
        .to_string()
}

fn json_rpc_result_response(request_id: Option<u64>, result: Value) -> Response {
    let body = json!({
        "id": request_id,
        "result": result,
    });
    (StatusCode::OK, Json(body)).into_response()
}

fn json_rpc_error_response(
    request_id: Option<u64>,
    status: StatusCode,
    message: &str,
) -> Response {
    let body = json!({
        "id": request_id,
        "error": {
            "message": message,
        },
    });
    (status, Json(body)).into_response()
}

fn json_rpc_result_text(request_id: Option<u64>, result: Value) -> String {
    serde_json::to_string(&json!({
        "id": request_id,
        "result": result,
    }))
    .unwrap_or_else(|_| "{\"id\":null,\"error\":{\"message\":\"serialization failed\"}}".to_string())
}

fn json_rpc_error_text(request_id: Option<u64>, message: &str) -> String {
    serde_json::to_string(&json!({
        "id": request_id,
        "error": {
            "message": message,
        },
    }))
    .unwrap_or_else(|_| "{\"id\":null,\"error\":{\"message\":\"serialization failed\"}}".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tower::util::ServiceExt;

    fn test_http_state(token: Option<&str>) -> HttpAppState {
        let temp_dir = std::env::temp_dir().join(format!(
            "codex-monitor-http-test-{}",
            std::process::id()
        ));
        let _ = std::fs::create_dir_all(&temp_dir);
        let (tx, _rx) = broadcast::channel::<DaemonEvent>(32);
        let config = Arc::new(DaemonConfig {
            listen: "127.0.0.1:4732".parse().expect("tcp listen"),
            http_listen: Some("127.0.0.1:4733".parse().expect("http listen")),
            token: token.map(str::to_string),
            data_dir: temp_dir.clone(),
        });
        let daemon_state = Arc::new(DaemonState::load(
            &config,
            DaemonEventSink { tx: tx.clone() },
        ));
        HttpAppState {
            config,
            daemon_state,
            events: tx,
        }
    }

    #[tokio::test]
    async fn healthz_returns_ok_payload() {
        let app = build_router(test_http_state(Some("token-1")));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/healthz")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn http_rpc_rejects_missing_bearer_token() {
        let app = build_router(test_http_state(Some("token-1")));

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/rpc")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&json!({
                            "id": 1,
                            "method": "daemon_info",
                            "params": {}
                        }))
                        .expect("serialize request"),
                    ))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn http_rpc_accepts_bearer_token_and_dispatches_rpc() {
        let app = build_router(test_http_state(Some("token-1")));

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/rpc")
                    .header("authorization", "Bearer token-1")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_vec(&json!({
                            "id": 7,
                            "method": "daemon_info",
                            "params": {}
                        }))
                        .expect("serialize request"),
                    ))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::OK);
    }
}
