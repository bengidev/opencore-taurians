use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum ExplorerError {
    OutsideProject(String),
    NotFound(String),
    AlreadyExists(String),
    Invalid(String),
    Io(String),
}

impl From<std::io::Error> for ExplorerError {
    fn from(value: std::io::Error) -> Self {
        ExplorerError::Io(value.to_string())
    }
}
