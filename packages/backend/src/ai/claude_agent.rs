use crate::ai::llm::models::Message;
use crate::{BackendError, BackendResult};
use neon::event::Channel;
use neon::handle::Root;
use neon::prelude::*;
use neon::types::{JsFunction, JsPromise, JsString, JsValue};
use serde::{Deserialize, Serialize};
use std::sync::{mpsc, Arc, Mutex};

// Debug logging flag
const DEBUG_CLAUDE_AGENT: bool = true;

macro_rules! log_debug {
    ($($arg:tt)*) => {
        if DEBUG_CLAUDE_AGENT {
            tracing::info!("[Claude Agent Rust] {}", format!($($arg)*));
        }
    };
}

macro_rules! log_error {
    ($($arg:tt)*) => {
        tracing::error!("[Claude Agent Rust ERROR] {}", format!($($arg)*));
    };
}

#[derive(Clone)]
pub struct ClaudeAgentRuntime {
    runner: Arc<Mutex<Option<Root<JsFunction>>>>,
    channel: Channel,
    default_cwd: String,
}

impl ClaudeAgentRuntime {
    pub fn new(
        runner: Arc<Mutex<Option<Root<JsFunction>>>>,
        channel: Channel,
        default_cwd: String,
    ) -> Self {
        log_debug!("Creating new ClaudeAgentRuntime with cwd: {}", default_cwd);
        log_debug!("  Arc pointer: {:p}", Arc::as_ptr(&runner));
        let has_runner = runner.lock().map(|g| g.is_some()).unwrap_or(false);
        log_debug!("  Runner present at creation: {}", has_runner);
        Self {
            runner,
            channel,
            default_cwd,
        }
    }

    pub fn has_runner(&self) -> bool {
        log_debug!(
            "has_runner check - Arc pointer: {:p}",
            Arc::as_ptr(&self.runner)
        );
        let has = self
            .runner
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false);
        log_debug!("has_runner check result: {}", has);
        has
    }

    pub fn update_default_cwd(&mut self, cwd: String) {
        log_debug!(
            "Updating default cwd from '{}' to '{}'",
            self.default_cwd,
            cwd
        );
        self.default_cwd = cwd;
    }

    pub fn build_request(
        &self,
        messages: Vec<Message>,
        custom_key: Option<String>,
        model: Option<String>,
    ) -> ClaudeAgentRequest {
        log_debug!("Building Claude Agent request:");
        log_debug!("  - Messages count: {}", messages.len());
        log_debug!("  - Has custom key: {}", custom_key.is_some());
        log_debug!("  - Model: {:?}", model);
        log_debug!("  - CWD: {}", self.default_cwd);

        ClaudeAgentRequest {
            messages,
            custom_key: custom_key.and_then(|key| {
                let trimmed = key.trim().to_string();
                if trimmed.is_empty() {
                    log_debug!("  - Custom key trimmed to empty, ignoring");
                    None
                } else {
                    log_debug!(
                        "  - Custom key validated (starts with: {}...)",
                        &trimmed[..7.min(trimmed.len())]
                    );
                    Some(trimmed)
                }
            }),
            cwd: Some(self.default_cwd.clone()),
            model,
        }
    }

    pub fn run_completion(&self, request: ClaudeAgentRequest) -> BackendResult<String> {
        log_debug!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        log_debug!("run_completion called");

        if !self.has_runner() {
            log_error!("Bridge is not registered - cannot run completion");
            return Err(BackendError::GenericError(
                "Claude Code Agent bridge is not registered".to_string(),
            ));
        }

        log_debug!("Bridge is registered, proceeding with completion");

        log_debug!("Serializing request to JSON...");
        let payload = serde_json::to_string(&request).map_err(|err| {
            log_error!("Failed to serialize request: {}", err);
            BackendError::GenericError(format!("failed to serialize Claude Agent request: {err}"))
        })?;

        log_debug!("Serialized payload length: {} bytes", payload.len());
        log_debug!("Payload preview: {}...", &payload[..100.min(payload.len())]);

        log_debug!("Creating mpsc channel for result communication");
        let (tx, rx) = mpsc::channel();
        let runner_arc = Arc::clone(&self.runner);

        log_debug!("Sending task to Neon event channel...");
        let handle = self.channel.send(move |mut cx| -> NeonResult<()> {
                tracing::info!("[Claude Agent Rust] Inside Neon event handler");

                let runner = {
                    let guard = match runner_arc.lock() {
                        Ok(guard) => guard,
                        Err(_) => {
                            tracing::error!("[Claude Agent Rust ERROR] Mutex poisoned");
                            let _ = tx.send(Err(BackendError::GenericError(
                                "Claude Code Agent bridge mutex poisoned".to_string(),
                            )));
                            return Ok(());
                        }
                    };
                    match guard.as_ref() {
                        Some(root) => {
                            tracing::info!("[Claude Agent Rust] Runner function found in mutex");
                            root.clone(&mut cx)
                        },
                        None => {
                            tracing::error!("[Claude Agent Rust ERROR] Runner not registered in mutex");
                            let _ = tx.send(Err(BackendError::GenericError(
                                "Claude Code Agent bridge is not registered".to_string(),
                            )));
                            return Ok(());
                        }
                    }
                };

                tracing::info!("[Claude Agent Rust] Preparing to call JS runner function");
                let runner_fn = runner.into_inner(&mut cx);
                let this = cx.undefined();
                let arg = cx.string(&payload);

                tracing::info!("[Claude Agent Rust] Calling JS runner with payload...");
                let result = runner_fn.call(&mut cx, this, [arg.upcast::<JsValue>()]);

                match result {
                    Ok(value) => {
                        if value.is_a::<JsPromise, _>(&mut cx) {
                            tracing::info!("[Claude Agent Rust] JS runner returned a Promise");
                            let promise = match value.downcast::<JsPromise, _>(&mut cx) {
                                Ok(promise) => promise,
                                Err(_) => {
                                    tracing::error!("[Claude Agent Rust ERROR] Promise downcast failed");
                                    let _ = tx.send(Err(BackendError::GenericError(
                                        "Claude Agent bridge promise downcast failed".to_string(),
                                    )));
                                    return Ok(());
                                }
                            };
                            tracing::info!("[Claude Agent Rust] Converting Promise to Future...");
                            let tx_clone = tx.clone();
                            let _future = match promise.to_future(&mut cx, move |mut cx, outcome| {
                                tracing::info!("[Claude Agent Rust] Promise resolved/rejected callback triggered");
                                let send_result = match outcome {
                                    Ok(resolved) => {
                                        tracing::info!("[Claude Agent Rust] Promise resolved successfully");
                                        let json_value = resolved.downcast_or_throw::<JsString, _>(&mut cx);
                                        match json_value {
                                            Ok(js_string) => {
                                                let response = js_string.value(&mut cx);
                                                tracing::info!("[Claude Agent Rust] Got JSON response, length: {}", response.len());
                                                serde_json::from_str::<ClaudeAgentResponse>(&response)
                                                    .map_err(|err| {
                                                        tracing::error!("[Claude Agent Rust ERROR] Failed to parse response JSON: {}", err);
                                                        BackendError::GenericError(format!(
                                                            "failed to parse Claude Agent response: {err}"
                                                        ))
                                                    })
                                            }
                                            Err(_) => {
                                                tracing::error!("[Claude Agent Rust ERROR] Response is not a string");
                                                Err(BackendError::GenericError(
                                                    "Claude Agent bridge must resolve with a JSON string".to_string(),
                                                ))
                                            }
                                        }
                                    }
                                    Err(js_error) => {
                                        tracing::error!("[Claude Agent Rust ERROR] Promise rejected: {:?}", js_error);
                                        Err(BackendError::GenericError(format!(
                                            "Claude Agent bridge promise rejected: {:?}",
                                            js_error
                                        )))
                                    }
                                };
                                tracing::info!("[Claude Agent Rust] Sending result back through channel");
                                let _ = tx_clone.send(send_result);
                                Ok(())
                            }) {
                                Ok(future) => {
                                    tracing::info!("[Claude Agent Rust] Promise future created successfully");
                                    future
                                },
                                Err(_) => {
                                    tracing::error!("[Claude Agent Rust ERROR] Failed to create promise future");
                                    let _ = tx.send(Err(BackendError::GenericError(
                                        "Failed to create promise future".to_string(),
                                    )));
                                    return Ok(());
                                }
                            };
                            let _ = _future;
                        } else if value.is_a::<JsString, _>(&mut cx) {
                            tracing::info!("[Claude Agent Rust] JS runner returned a String (sync)");
                            let response = match value.downcast::<JsString, _>(&mut cx) {
                                Ok(js_string) => js_string.value(&mut cx),
                                Err(_) => {
                                    tracing::error!("[Claude Agent Rust ERROR] String downcast failed");
                                    let _ = tx.send(Err(BackendError::GenericError(
                                        "Claude Agent bridge must return a string".to_string(),
                                    )));
                                    return Ok(());
                                }
                            };
                            tracing::info!("[Claude Agent Rust] Got sync string response, length: {}", response.len());
                            let parsed = serde_json::from_str::<ClaudeAgentResponse>(&response)
                                .map_err(|err| {
                                    tracing::error!("[Claude Agent Rust ERROR] Failed to parse sync response: {}", err);
                                    BackendError::GenericError(format!(
                                        "failed to parse Claude Agent response: {err}"
                                    ))
                                });
                            let _ = tx.send(parsed);
                        } else {
                            tracing::error!("[Claude Agent Rust ERROR] JS runner returned neither Promise nor String");
                            let _ = tx.send(Err(BackendError::GenericError(
                                "Claude Agent bridge must return a Promise or string".to_string(),
                            )));
                        }
                    }
                    Err(err) => {
                        tracing::error!("[Claude Agent Rust ERROR] JS runner call failed: {:?}", err);
                        let _ = tx.send(Err(BackendError::GenericError(format!(
                            "Claude Agent bridge call failed: {err:?}"
                        ))));
                    }
                }

                Ok(())
            });

        let _ = handle;

        log_debug!("Waiting for response from JS bridge via channel...");
        let response = rx.recv().map_err(|err| {
            log_error!("Channel closed while waiting for response: {}", err);
            BackendError::GenericError(format!("Claude Agent bridge channel closed: {err}"))
        })??;

        log_debug!("Received response from JS bridge");
        log_debug!("Converting response to result...");
        let result = response.into_result();

        match &result {
            Ok(output) => {
                log_debug!("✅ Success! Output length: {} characters", output.len());
            }
            Err(err) => {
                log_error!("❌ Error in response: {}", err);
            }
        }

        log_debug!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        result
    }
}

#[derive(Serialize, Deserialize)]
pub struct ClaudeAgentRequest {
    pub messages: Vec<Message>,
    #[serde(default)]
    pub custom_key: Option<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ClaudeAgentResponse {
    pub output: String,
    #[serde(default)]
    pub error: Option<String>,
}

impl ClaudeAgentResponse {
    pub fn into_result(self) -> BackendResult<String> {
        if let Some(error) = self.error {
            log_error!("Response contains error: {}", error);
            Err(BackendError::GenericError(error))
        } else {
            log_debug!("Response OK, output length: {}", self.output.len());
            Ok(self.output)
        }
    }
}

pub type ClaudeAgentRunnerHandle = Arc<Mutex<Option<Root<JsFunction>>>>;
