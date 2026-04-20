import { useState, useEffect, useRef } from "react";

function highlightOQL(code) {
  return code.split("\n").map((line, i) => {
    let html = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Comment lines — wrap and skip further highlighting
    if (html.trimStart().startsWith('#')) {
      html = html.replace(/(#.*)$/, '<span class="syn-comment">$1</span>');
      return `<span class="line-num">${String(i + 1).padStart(3)}</span>${html}`;
    }

    // Extract quoted strings into placeholders (prevents keyword/number matching inside)
    const strings = [];
    html = html.replace(/("[^"]*"|'[^']*')/g, (m) => {
      strings.push(m);
      return `\x00S${strings.length - 1}\x00`;
    });

    html = html.replace(
      /\b(SCENARIO|DEVICE_TYPE|DEVICE_MODEL|MANUFACTURER|GOAL|FUNC|CONFIG|MACRO|INCLUDE|CALL|SET|GET|WAIT|SAVE|SAMPLE|CHECK|IF|CORRECT|ERROR|MIN|MAX|VAL|NAME|LOG|ASSERT_STATUS|ASSERT_JSON|ASSERT_SENSOR|ASSERT_VALVE|API_GET|EXPECT_DEVICE|EXPECT_I2C_BUS|EXPECT_I2C_CHIP|SHELL_EXPORT)\b/g,
      '<span class="syn-keyword">$1</span>'
    );
    html = html.replace(/→/g, '<span class="syn-arrow">→</span>');
    html = html.replace(
      /\b(\d+\.?\d*)(\s*)(ms|mbar|bar|l\/min|l|s|%RH|°C|N|V|szt)\b/g,
      '<span class="syn-number">$1</span>$2<span class="syn-unit">$3</span>'
    );
    html = html.replace(
      /(?<!class=")\b(\d+\.?\d*)\b(?!["<\x00])/g,
      '<span class="syn-number">$1</span>'
    );

    // Re-insert strings with highlighting
    html = html.replace(/\x00S(\d+)\x00/g, (_, idx) => {
      return `<span class="syn-string">${strings[Number(idx)]}</span>`;
    });

    return `<span class="line-num">${String(i + 1).padStart(3)}</span>${html}`;
  });
}

function highlightIQL(code) {
  return code.split("\n").map((line, i) => {
    let html = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Comment lines — wrap and skip further highlighting
    if (html.trimStart().startsWith('#')) {
      html = html.replace(/(#.*)$/, '<span class="syn-comment">$1</span>');
      return `<span class="line-num">${String(i + 1).padStart(3)}</span>${html}`;
    }

    // Extract quoted strings into placeholders
    const strings = [];
    html = html.replace(/("[^"]*"|'[^']*')/g, (m) => {
      strings.push(m);
      return `\x00S${strings.length - 1}\x00`;
    });

    html = html.replace(
      /\b(SET|LOG|API|GET|POST|PUT|DELETE|ASSERT_STATUS|ASSERT_OK|ASSERT_CONTAINS|ASSERT_JSON|ASSERT_VISIBLE|ASSERT_TEXT|NAVIGATE|WAIT|CLICK|INPUT|SELECT_DEVICE|SELECT_INTERVAL|START_TEST|STEP_COMPLETE|RECORD_START|RECORD_STOP|REPLAY|INCLUDE|ENCODER_ON|ENCODER_OFF|ENCODER_CLICK|ENCODER_SCROLL|ENCODER_FOCUS)\b/g,
      '<span class="syn-keyword">$1</span>'
    );
    html = html.replace(
      /\$\{[^}]+\}/g,
      '<span class="syn-interp">$&</span>'
    );
    html = html.replace(
      /(?<!class=")\b(\d+\.?\d*)\b(?!["<\x00])/g,
      '<span class="syn-number">$1</span>'
    );

    // Re-insert strings with highlighting
    html = html.replace(/\x00S(\d+)\x00/g, (_, idx) => {
      return `<span class="syn-string">${strings[Number(idx)]}</span>`;
    });

    return `<span class="line-num">${String(i + 1).padStart(3)}</span>${html}`;
  });
}

export default function CodeEditor({ example, value, onChange }) {
  const [localCode, setLocalCode] = useState(value || example.code);
  const [highlighted, setHighlighted] = useState([]);
  const textareaRef = useRef(null);
  const preRef = useRef(null);

  // Derive current code from props or state
  const code = value !== undefined ? value : localCode;

  // Sync with external value when example changes and no external value provided
  useEffect(() => {
    if (value === undefined) {
      setLocalCode(example.code);
    }
  }, [example, value]);

  // Update highlighting when code or language changes
  useEffect(() => {
    const fn = example.lang === "oql" ? highlightOQL : highlightIQL;
    setHighlighted(fn(code));
  }, [code, example.lang]);

  const handleScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleChange = (e) => {
    const newCode = e.target.value;
    setLocalCode(newCode);
    onChange?.(newCode);
  };

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <span className="file-badge">{example.lang === "oql" ? "⚙ .oql" : "🧪 .testql.toon.yaml"}</span>
        <span className="file-title">{example.title}</span>
      </div>
      <div className="editor-body">
        <pre
          ref={preRef}
          className="editor-highlight"
          dangerouslySetInnerHTML={{ __html: highlighted.join("\n") }}
        />
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={code}
          onChange={handleChange}
          onScroll={handleScroll}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
