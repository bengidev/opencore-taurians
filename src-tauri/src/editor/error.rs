use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum EditorError {
    OutsideProject(String),
    NotFound(String),
    NotAFile(String),
    TooLarge(String),
    BinaryOrNonUtf8(String),
    Io(String),
}

impl From<std::io::Error> for EditorError {
    fn from(value: std::io::Error) -> Self {
        EditorError::Io(value.to_string())
    }
}
