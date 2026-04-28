// Chinese IME dedup logic test — extracted from XtermPane.tsx
// Run: node scripts/test-chinese-ime.js
var results = [];
var lastOnData = { text: "", time: 0 };
var writes = [];

function writeSession(data) { writes.push(data); }

function onData(data) {
    lastOnData = { text: data, time: Date.now() };
    writeSession(data);
}

function onCompositionEnd(text, taValue) {
    if (!text) return;
    if (lastOnData.text === text && Date.now() - lastOnData.time < 50) return;
    if (!taValue || taValue.trim() === "") {
        writeSession(text);
    }
}

// Test 1: Standard IME — onData fires, then compositionend with same text
writes.length = 0;
onData("\u4f60\u597d");
onCompositionEnd("\u4f60\u597d", "");
results.push({ name: "standard_ime_no_dup", pass: writes.length === 1 });

// Test 2: Sogou fallback — only compositionend fires
writes.length = 0;
lastOnData = { text: "", time: 0 };
onCompositionEnd("\u6d4b\u8bd5", "");
results.push({ name: "sogou_fallback_works", pass: writes.length === 1 });

// Test 3: Different text not blocked
writes.length = 0;
lastOnData = { text: "abc", time: Date.now() };
onCompositionEnd("\u4f60\u597d", "");
results.push({ name: "different_text_not_blocked", pass: writes.length === 1 });

// Test 4: Stale onData (>50ms) not blocked
writes.length = 0;
lastOnData = { text: "\u4f60\u597d", time: Date.now() - 100 };
onCompositionEnd("\u4f60\u597d", "");
results.push({ name: "stale_ondata_not_blocked", pass: writes.length === 1 });

// Test 5: textarea has value — skip
writes.length = 0;
lastOnData = { text: "", time: 0 };
onCompositionEnd("\u4f60\u597d", "\u4f60\u597d");
results.push({ name: "textarea_has_value_skipped", pass: writes.length === 0 });

// Test 6: Rapid compositions
writes.length = 0;
onData("\u7b2c\u4e00");
onCompositionEnd("\u7b2c\u4e00", "");
onData("\u7b2c\u4e8c");
onCompositionEnd("\u7b2c\u4e8c", "");
results.push({ name: "rapid_compositions_no_dup", pass: writes.length === 2 });

// Test 7: Mixed Chinese and English
writes.length = 0;
onData("Hello\u4f60\u597d");
onCompositionEnd("Hello\u4f60\u597d", "");
results.push({ name: "mixed_chinese_english_no_dup", pass: writes.length === 1 });

// Test 8: Empty compositionend
writes.length = 0;
onCompositionEnd("", "");
results.push({ name: "empty_composition_ignored", pass: writes.length === 0 });

// Test 9: Long Chinese text
writes.length = 0;
var longText = "\u8fd9\u662f\u4e00\u6bb5\u6bd4\u8f83\u957f\u7684\u4e2d\u6587\u6587\u672c";
onData(longText);
onCompositionEnd(longText, "");
results.push({ name: "long_chinese_no_dup", pass: writes.length === 1 });

// Output
var passed = 0;
var failed = 0;
for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.pass) { passed++; console.log("  [PASS] " + r.name); }
    else { failed++; console.log("  [FAIL] " + r.name); }
}
console.log("\n  Total: " + results.length + " tests, " + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
