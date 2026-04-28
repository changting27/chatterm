/// Chinese input integration tests: verify that Chinese text written to PTY
/// appears exactly once on the virtual screen (no duplication).
///
/// Cross-platform: uses `cat` on Unix, `findstr "^"` on Windows (both echo stdin).
///
/// Run: cd src-tauri && cargo test --test chinese_input -- --nocapture
use chatterm_lib::vscreen::VScreen;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::mpsc;
use std::time::Duration;

/// Build a cross-platform echo command (reads stdin, writes to stdout).
fn echo_cmd() -> CommandBuilder {
    #[cfg(windows)]
    {
        // findstr "^" on Windows echoes every stdin line to stdout
        let mut cmd = CommandBuilder::new("cmd.exe");
        cmd.args(["/C", "findstr \"^\""]);
        if let Ok(home) = std::env::var("USERPROFILE") {
            cmd.env("USERPROFILE", &home);
            cmd.cwd(&home);
        }
        cmd
    }
    #[cfg(not(windows))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
        let mut cmd = CommandBuilder::new(&shell);
        cmd.args(["-c", "cat"]);
        if let Ok(home) = std::env::var("HOME") {
            cmd.env("HOME", &home);
            cmd.cwd(&home);
        }
        cmd.env("TERM", "xterm-256color");
        cmd
    }
}

/// Spawn an echo process via PTY, write `input` once, collect VScreen rows.
fn pty_echo_test(input: &str, wait_ms: u64) -> Vec<String> {
    let pair = native_pty_system()
        .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        .unwrap();

    let mut child = pair.slave.spawn_command(echo_cmd()).unwrap();
    let mut reader = pair.master.try_clone_reader().unwrap();
    let mut writer = pair.master.take_writer().unwrap();

    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => { tx.send(buf[..n].to_vec()).ok(); }
            }
        }
    });

    writer.write_all(input.as_bytes()).unwrap();
    writer.flush().unwrap();
    std::thread::sleep(Duration::from_millis(wait_ms));

    let mut vs = VScreen::new();
    while let Ok(chunk) = rx.try_recv() {
        vs.feed(&chunk);
    }
    child.kill().ok();
    vs.rows()
}

/// Spawn an echo process via PTY, write `input` TWICE, collect VScreen rows.
fn pty_double_write_test(input: &str, wait_ms: u64) -> Vec<String> {
    let pair = native_pty_system()
        .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        .unwrap();

    let mut child = pair.slave.spawn_command(echo_cmd()).unwrap();
    let mut reader = pair.master.try_clone_reader().unwrap();
    let mut writer = pair.master.take_writer().unwrap();

    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => { tx.send(buf[..n].to_vec()).ok(); }
            }
        }
    });

    // Write TWICE — simulates the compositionend double-send bug
    writer.write_all(input.as_bytes()).unwrap();
    writer.write_all(input.as_bytes()).unwrap();
    writer.flush().unwrap();
    std::thread::sleep(Duration::from_millis(wait_ms));

    let mut vs = VScreen::new();
    while let Ok(chunk) = rx.try_recv() {
        vs.feed(&chunk);
    }
    child.kill().ok();
    vs.rows()
}

// ── Single write: text appears exactly once ──────────────────────────

#[test]
fn chinese_single_char_pty() {
    let rows = pty_echo_test("你", 300);
    let all = rows.join("");
    let n = all.matches("你").count();
    assert_eq!(n, 1, "你 should appear once, got {n} in {rows:?}");
}

#[test]
fn chinese_word_pty() {
    let rows = pty_echo_test("你好", 300);
    let all = rows.join("");
    let n = all.matches("你好").count();
    assert_eq!(n, 1, "你好 once, got {n} in {rows:?}");
}

#[test]
fn chinese_sentence_pty() {
    let rows = pty_echo_test("你好世界", 300);
    let all = rows.join("");
    let n = all.matches("你好世界").count();
    assert_eq!(n, 1, "你好世界 once, got {n} in {rows:?}");
}

#[test]
fn chinese_mixed_ascii_pty() {
    let rows = pty_echo_test("Hello你好", 300);
    assert!(rows.join("").contains("Hello你好"), "got: {rows:?}");
}

#[test]
fn chinese_with_punctuation_pty() {
    let rows = pty_echo_test("你好！", 300);
    assert!(rows.join("").contains("你好！"), "got: {rows:?}");
}

// ── Double write: proves duplication at PTY level ────────────────────

#[test]
fn chinese_double_write_shows_duplication() {
    let rows = pty_double_write_test("你好", 300);
    let n = rows.join("").matches("你好").count();
    assert!(n >= 2, "double write should duplicate, got {n} in {rows:?}");
}

#[test]
fn chinese_double_write_vs_single_write() {
    let s = pty_echo_test("测试", 300).join("");
    let d = pty_double_write_test("测试", 300).join("");
    assert_eq!(s.matches("测试").count(), 1);
    assert!(d.matches("测试").count() >= 2);
}

// ── Edge cases ───────────────────────────────────────────────────────

#[test]
fn chinese_newline_pty() {
    let rows = pty_echo_test("你好\n世界", 300);
    let all = rows.join("\n");
    assert!(all.contains("你好"), "got: {rows:?}");
    assert!(all.contains("世界"), "got: {rows:?}");
}

#[test]
fn chinese_long_text_pty() {
    let input = "这是一段比较长的中文文本用来测试";
    let rows = pty_echo_test(input, 500);
    let all = rows.join("");
    assert!(all.contains(input), "got: {rows:?}");
    assert_eq!(all.matches(input).count(), 1);
}
