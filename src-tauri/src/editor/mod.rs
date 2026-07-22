pub mod create;
mod error;
pub mod path_query;
pub mod read;
pub mod read_external;
pub mod write;

pub use create::editor_create_file;
pub use path_query::{editor_is_under_root, editor_paths_include_directory};
pub use read::editor_read_file;
pub use read_external::editor_read_external_file;
pub use write::editor_write_file;
