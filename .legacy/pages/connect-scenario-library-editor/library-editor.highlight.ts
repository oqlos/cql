// frontend/src/pages/connect-scenario-library-editor/library-editor.highlight.ts
import { escapeHtml } from '../../modules/shared/generic-grid/utils';

/** Simple JSON syntax highlighting */
export function highlightJson(code: string, container: HTMLElement): void {
  let html = escapeHtml(code);
  // Highlight strings (keys and values)
  html = html.replace(/"([^"\\]|\\.)*"/g, '<span class="def-syntax-string">$&</span>');
  // Highlight numbers
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="def-syntax-number">$1</span>');
  // Highlight keywords
  html = html.replace(/\b(true|false|null)\b/g, '<span class="def-syntax-keyword">$1</span>');
  container.innerHTML = html;
}

/** Tokenize and highlight source code */
export function highlightSource(code: string, container: HTMLElement): void {
  const tokens: Array<{ type: string; value: string }> = [];
  let remaining = code;
  
  while (remaining.length > 0) {
    let matched = false;
    
    // Comments (must be first)
    const commentMatch = remaining.match(/^\/\/.*/);
    if (commentMatch) {
      tokens.push({ type: 'comment', value: commentMatch[0] });
      remaining = remaining.slice(commentMatch[0].length);
      matched = true;
      continue;
    }
    
    // Strings
    const doubleStringMatch = remaining.match(/^"(?:[^"\\]|\\.)*"/);
    if (doubleStringMatch) {
      tokens.push({ type: 'string', value: doubleStringMatch[0] });
      remaining = remaining.slice(doubleStringMatch[0].length);
      matched = true;
      continue;
    }
    
    const singleStringMatch = remaining.match(/^'(?:[^'\\]|\\.)*'/);
    if (singleStringMatch) {
      tokens.push({ type: 'string', value: singleStringMatch[0] });
      remaining = remaining.slice(singleStringMatch[0].length);
      matched = true;
      continue;
    }
    
    // Keywords
    const keywordMatch = remaining.match(/^(const|let|var|function|return|if|else|typeof|module|exports|Object|null|undefined|true|false)\b/);
    if (keywordMatch) {
      tokens.push({ type: 'keyword', value: keywordMatch[0] });
      remaining = remaining.slice(keywordMatch[0].length);
      matched = true;
      continue;
    }
    
    // Numbers
    const numberMatch = remaining.match(/^\d+\.?\d*/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: numberMatch[0] });
      remaining = remaining.slice(numberMatch[0].length);
      matched = true;
      continue;
    }
    
    // Identifiers (plain text)
    const identMatch = remaining.match(/^[a-zA-Z_]\w*/);
    if (identMatch) {
      tokens.push({ type: 'plain', value: identMatch[0] });
      remaining = remaining.slice(identMatch[0].length);
      matched = true;
      continue;
    }
    
    // Any other character
    if (!matched) {
      tokens.push({ type: 'plain', value: remaining[0] });
      remaining = remaining.slice(1);
    }
  }
  
  // Build highlighted HTML
  const html = tokens.map(t => {
    const escaped = escapeHtml(t.value);
    switch (t.type) {
      case 'keyword': return `<span class="def-syntax-keyword">${escaped}</span>`;
      case 'string': return `<span class="def-syntax-string">${escaped}</span>`;
      case 'number': return `<span class="def-syntax-number">${escaped}</span>`;
      case 'comment': return `<span class="def-syntax-comment">${escaped}</span>`;
      default: return escaped;
    }
  }).join('');
  
  container.innerHTML = html;
}
