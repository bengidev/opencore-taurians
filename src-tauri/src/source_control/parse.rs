use crate::source_control::contracts::{
    SourceControlFileCode, SourceControlFileStatus, SourceControlHeadSummary,
};

#[derive(Debug, Default, PartialEq, Eq)]
pub struct ParsedStatus {
    pub head: Option<SourceControlHeadSummary>,
    pub upstream: Option<String>,
    pub ahead: u64,
    pub behind: u64,
    pub files: Vec<SourceControlFileStatus>,
}

pub fn parse_porcelain_v2(input: &[u8]) -> ParsedStatus {
    let mut result = ParsedStatus::default();
    for raw in input.split(|byte| *byte == 0) {
        if raw.is_empty() {
            continue;
        }
        let line = String::from_utf8_lossy(raw);
        if let Some(value) = line.strip_prefix("# branch.head ") {
            result.head = Some(if value == "(detached)" {
                SourceControlHeadSummary::Detached { oid: String::new() }
            } else if value == "(unknown)" {
                SourceControlHeadSummary::Unborn { name: None }
            } else if matches!(result.head, Some(SourceControlHeadSummary::Unborn { .. })) {
                SourceControlHeadSummary::Unborn {
                    name: Some(value.to_string()),
                }
            } else {
                SourceControlHeadSummary::Branch {
                    name: value.to_string(),
                }
            });
            continue;
        }
        if let Some(value) = line.strip_prefix("# branch.oid ") {
            match result.head.as_mut() {
                Some(SourceControlHeadSummary::Detached { oid }) => *oid = value.to_string(),
                None if value == "(initial)" => {
                    result.head = Some(SourceControlHeadSummary::Unborn { name: None })
                }
                _ => {}
            }
            continue;
        }
        if let Some(value) = line.strip_prefix("# branch.upstream ") {
            result.upstream = Some(value.to_string());
            continue;
        }
        if let Some(value) = line.strip_prefix("# branch.ab ") {
            for part in value.split_whitespace() {
                if let Some(ahead) = part.strip_prefix('+') {
                    result.ahead = ahead.parse().unwrap_or(0);
                } else if let Some(behind) = part.strip_prefix('-') {
                    result.behind = behind.parse().unwrap_or(0);
                }
            }
            continue;
        }
        if let Some(file) = parse_file_record(&line) {
            result.files.push(file);
        }
    }
    result
}

fn parse_file_record(line: &str) -> Option<SourceControlFileStatus> {
    if let Some(path) = line.strip_prefix("? ") {
        return Some(file_status(
            path,
            None,
            None,
            Some(SourceControlFileCode::Untracked),
        ));
    }
    if let Some(path) = line.strip_prefix("! ") {
        return Some(file_status(
            path,
            None,
            None,
            Some(SourceControlFileCode::Ignored),
        ));
    }
    let fields: Vec<&str> = line.splitn(10, ' ').collect();
    match fields.first().copied()? {
        "1" => {
            let xy = fields.get(1)?.as_bytes();
            let path = fields.get(8)?.to_string();
            Some(file_status(
                &path,
                None,
                code(xy.first().copied()?),
                code(xy.get(1).copied()?),
            ))
        }
        "2" => {
            let xy = fields.get(1)?.as_bytes();
            let path_pair = fields.get(9)?.split_once('\t');
            let (path, old_path) = path_pair
                .map(|(new_path, old_path)| (new_path, Some(old_path.to_string())))
                .unwrap_or((fields.get(9)?, None));
            Some(file_status(
                path,
                old_path,
                code(xy.first().copied()?),
                code(xy.get(1).copied()?),
            ))
        }
        "u" => {
            let path = fields.get(10).or_else(|| fields.last())?.to_string();
            Some(SourceControlFileStatus {
                path,
                old_path: None,
                index_status: Some(SourceControlFileCode::Conflicted),
                worktree_status: Some(SourceControlFileCode::Conflicted),
                conflict_status: fields.get(1).map(|value| (*value).to_string()),
                additions: None,
                deletions: None,
                binary: false,
                submodule: false,
                lfs_pointer: false,
            })
        }
        _ => None,
    }
}

fn file_status(
    path: &str,
    old_path: Option<String>,
    index_status: Option<SourceControlFileCode>,
    worktree_status: Option<SourceControlFileCode>,
) -> SourceControlFileStatus {
    SourceControlFileStatus {
        path: path.to_string(),
        old_path,
        index_status,
        worktree_status,
        conflict_status: None,
        additions: None,
        deletions: None,
        binary: false,
        submodule: false,
        lfs_pointer: false,
    }
}

fn code(value: u8) -> Option<SourceControlFileCode> {
    match value {
        b'.' | b' ' => None,
        b'A' => Some(SourceControlFileCode::Added),
        b'M' => Some(SourceControlFileCode::Modified),
        b'D' => Some(SourceControlFileCode::Deleted),
        b'R' => Some(SourceControlFileCode::Renamed),
        b'C' => Some(SourceControlFileCode::Copied),
        b'T' => Some(SourceControlFileCode::TypeChanged),
        b'U' => Some(SourceControlFileCode::Conflicted),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_unborn_state_when_branch_name_follows_initial_oid() {
        let parsed = parse_porcelain_v2(b"# branch.oid (initial)\0# branch.head main\0");
        assert_eq!(
            parsed.head,
            Some(SourceControlHeadSummary::Unborn {
                name: Some("main".to_string())
            })
        );
    }

    #[test]
    fn parses_branch_divergence_and_files() {
        let parsed = parse_porcelain_v2(
            b"# branch.oid abc\0# branch.head feature/x\0# branch.upstream origin/feature/x\0# branch.ab +2 -3\x001 M. N... 100644 100644 100644 abc def src/a.ts\0? new file.txt\0",
        );
        assert_eq!(
            parsed.head,
            Some(SourceControlHeadSummary::Branch {
                name: "feature/x".to_string()
            })
        );
        assert_eq!(parsed.upstream.as_deref(), Some("origin/feature/x"));
        assert_eq!((parsed.ahead, parsed.behind), (2, 3));
        assert_eq!(parsed.files.len(), 2);
        assert_eq!(
            parsed.files[0].index_status,
            Some(SourceControlFileCode::Modified)
        );
        assert_eq!(
            parsed.files[1].worktree_status,
            Some(SourceControlFileCode::Untracked)
        );
    }
}
