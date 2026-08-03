use std::io::Write;

use tauri::State;

use super::error::PublicTerminalError;
use super::registry::TerminalSessionState;
use super::session::TerminalSession;
use super::types::{
    TerminalChannel, TerminalGetSizeInput, TerminalGetSizeResult, TerminalKillInput,
    TerminalResizeInput, TerminalSessionInfo, TerminalSpawnInput, TerminalWriteInput,
};

#[tauri::command]
pub fn terminal_spawn(
    input: TerminalSpawnInput,
    channel: TerminalChannel,
    state: State<'_, TerminalSessionState>,
) -> Result<TerminalSessionInfo, PublicTerminalError> {
    let (session, info) = TerminalSession::spawn(input, channel)?;
    state.insert(session);
    Ok(info)
}

#[tauri::command]
pub fn terminal_write(
    input: TerminalWriteInput,
    state: State<'_, TerminalSessionState>,
) -> Result<(), PublicTerminalError> {
    let session = state
        .get(&input.session_id)
        .ok_or_else(|| PublicTerminalError::SessionNotFound {
            session_id: input.session_id.clone(),
        })?;

    let mut writer = session.writer.lock();
    writer
        .write_all(input.data.as_bytes())
        .map_err(|e| PublicTerminalError::WriteFailed {
            message: e.to_string(),
        })?;
    writer.flush().map_err(|e| PublicTerminalError::WriteFailed {
        message: e.to_string(),
    })?;

    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    input: TerminalResizeInput,
    state: State<'_, TerminalSessionState>,
) -> Result<(), PublicTerminalError> {
    let session = state
        .get(&input.session_id)
        .ok_or_else(|| PublicTerminalError::SessionNotFound {
            session_id: input.session_id.clone(),
        })?;

    session
        .master
        .lock()
        .resize(portable_pty::PtySize {
            rows: input.rows,
            cols: input.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| PublicTerminalError::ResizeFailed {
            message: e.to_string(),
        })?;

    Ok(())
}

#[tauri::command]
pub fn terminal_get_size(
    input: TerminalGetSizeInput,
    state: State<'_, TerminalSessionState>,
) -> Result<TerminalGetSizeResult, PublicTerminalError> {
    let session = state
        .get(&input.session_id)
        .ok_or_else(|| PublicTerminalError::SessionNotFound {
            session_id: input.session_id.clone(),
        })?;

    let size = session
        .master
        .lock()
        .get_size()
        .map_err(|e| PublicTerminalError::ResizeFailed {
            message: e.to_string(),
        })?;

    Ok(TerminalGetSizeResult {
        cols: size.cols,
        rows: size.rows,
    })
}

#[tauri::command]
pub fn terminal_kill(
    input: TerminalKillInput,
    state: State<'_, TerminalSessionState>,
) -> Result<(), PublicTerminalError> {
    if let Some(session) = state.remove(&input.session_id) {
        let mut killer = session.killer.lock();
        let _ = killer.kill();
        if let Some(handle) = session.reader_thread.lock().take() {
            let _ = handle.join();
        }
    }
    Ok(())
}
