---
name: accessibility
description: Ensure WCAG 2.1 AA compliance and implement accessibility best practices
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL APPLICATION ACCESSIBILITY AUDIT**
Auditing entire application for WCAG 2.1 AA compliance...
{{else}}
**Mode: RECENT CHANGES ACCESSIBILITY**
Focusing on recently modified UI components. I will:
1. Check accessibility of new or modified components
2. Validate recent form or navigation changes
3. Focus on UI elements you've recently shown me or discussed

To audit the entire application's accessibility, use: `/accessibility --all`
{{/if}}

Implement comprehensive accessibility features to ensure WCAG 2.1 AA compliance and inclusive user experience:

## WCAG 2.1 Compliance Audit

### Level A Requirements (Essential)
- [ ] **Images**: All images have alt text
- [ ] **Video**: Captions for pre-recorded video
- [ ] **Audio**: Transcripts for audio content
- [ ] **Structure**: Proper heading hierarchy (h1→h2→h3)
- [ ] **Forms**: All inputs have labels
- [ ] **Links**: Descriptive link text (not "click here")
- [ ] **Keyboard**: All functionality keyboard accessible
- [ ] **Focus**: Visible focus indicators
- [ ] **Errors**: Clear error identification and description

### Level AA Requirements (Recommended)
- [ ] **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
- [ ] **Resize**: Text can resize to 200% without horizontal scroll
- [ ] **Images of Text**: Avoid where possible
- [ ] **Navigation**: Multiple ways to find pages
- [ ] **Focus Order**: Logical tab order
- [ ] **Language**: Page language declared
- [ ] **Consistent Navigation**: Same order across pages
- [ ] **Error Prevention**: Confirmation for important actions

## Implementation Guidelines

### Semantic HTML
```html
<!-- BAD: Non-semantic -->
<div class="header">
  <div class="nav">
    <div onclick="navigate()">Home</div>
  </div>
</div>

<!-- GOOD: Semantic -->
<header>
  <nav aria-label="Main navigation">
    <a href="/home">Home</a>
  </nav>
</header>

<!-- Form with proper labels -->
<form>
  <label for="email">Email Address</label>
  <input type="email" id="email" required aria-describedby="email-error">
  <span id="email-error" role="alert">Please enter a valid email</span>
</form>
```

### ARIA Implementation
```html
<!-- Live regions for dynamic content -->
<div aria-live="polite" aria-atomic="true">
  <p>Search results updated: 42 items found</p>
</div>

<!-- Landmarks -->
<main role="main" aria-labelledby="page-title">
  <h1 id="page-title">Dashboard</h1>
</main>

<!-- Complex widgets -->
<div role="tablist" aria-label="Settings">
  <button role="tab" aria-selected="true" aria-controls="general-panel">
    General
  </button>
  <button role="tab" aria-selected="false" aria-controls="security-panel">
    Security
  </button>
</div>
```

### Keyboard Navigation
```javascript
// Keyboard trap management
class AccessibleModal {
  constructor(modalElement) {
    this.modal = modalElement;
    this.focusableElements = this.modal.querySelectorAll(
      'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
  }
  
  open() {
    this.previouslyFocused = document.activeElement;
    this.modal.style.display = 'block';
    this.modal.setAttribute('aria-hidden', 'false');
    this.firstFocusable.focus();
    document.addEventListener('keydown', this.handleKeyDown);
  }
  
  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.close();
    }
    
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === this.firstFocusable) {
          e.preventDefault();
          this.lastFocusable.focus();
        }
      } else {
        if (document.activeElement === this.lastFocusable) {
          e.preventDefault();
          this.firstFocusable.focus();
        }
      }
    }
  }
  
  close() {
    this.modal.style.display = 'none';
    this.modal.setAttribute('aria-hidden', 'true');
    this.previouslyFocused.focus();
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}
```

### Color and Contrast
```css
/* Ensure sufficient contrast */
:root {
  /* AA compliant color pairs */
  --text-primary: #212121;     /* On white: 16.1:1 ratio */
  --text-secondary: #666666;   /* On white: 5.74:1 ratio */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --link-color: #0066cc;       /* On white: 5.07:1 ratio */
  --error-color: #d32f2f;      /* On white: 5.94:1 ratio */
}

/* Focus indicators */
*:focus {
  outline: 3px solid #4A90E2;
  outline-offset: 2px;
}

/* Don't rely only on color */
.error {
  color: var(--error-color);
  font-weight: bold;
}

.error::before {
  content: "⚠ Error: ";  /* Add icon/text indicator */
}
```

### Screen Reader Support
```javascript
// Announce dynamic changes
class ScreenReaderAnnouncer {
  constructor() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.className = 'sr-only';
    document.body.appendChild(this.liveRegion);
  }
  
  announce(message, priority = 'polite') {
    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      this.liveRegion.textContent = '';
    }, 1000);
  }
}

// Usage
const announcer = new ScreenReaderAnnouncer();
announcer.announce('Form submitted successfully');
announcer.announce('Error: Invalid input', 'assertive');
```

### Responsive and Zoom Support
```css
/* Support 200% zoom without horizontal scroll */
.container {
  max-width: 100%;
  padding: 1rem;
}

/* Use relative units */
body {
  font-size: 1rem;  /* 16px default */
  line-height: 1.5;
}

h1 { font-size: 2rem; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.25rem; }

/* Responsive images */
img {
  max-width: 100%;
  height: auto;
}

/* Touch targets minimum 44x44px */
button, a, input[type="checkbox"] {
  min-height: 44px;
  min-width: 44px;
}
```

## Testing Tools and Methods

### Automated Testing
```javascript
// Jest + Testing Library
describe('Accessibility Tests', () => {
  test('form inputs have labels', () => {
    const { getByLabelText } = render(<LoginForm />);
    expect(getByLabelText('Email')).toBeInTheDocument();
    expect(getByLabelText('Password')).toBeInTheDocument();
  });
  
  test('images have alt text', () => {
    const { getAllByRole } = render(<Gallery />);
    const images = getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });
  });
  
  test('no accessibility violations', async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Manual Testing Checklist
- [ ] Navigate entire site using only keyboard
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Verify at 200% zoom
- [ ] Check color contrast with tools
- [ ] Test with Windows High Contrast mode
- [ ] Validate forms with errors
- [ ] Test with slow connection
- [ ] Verify video captions
- [ ] Check focus order

### Browser Extensions
- axe DevTools
- WAVE
- Lighthouse
- Color Contrast Analyzer
- HeadingsMap
- Web Developer Toolbar

## Common Patterns

### Skip Links
```html
<a href="#main" class="skip-link">Skip to main content</a>

<style>
.skip-link {
  position: absolute;
  left: -9999px;
}

.skip-link:focus {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 999;
  padding: 1rem;
  background: #000;
  color: #fff;
}
</style>
```

### Loading States
```html
<button aria-busy="true" aria-label="Loading, please wait">
  <span aria-hidden="true">⏳</span>
  Loading...
</button>

<div role="status" aria-live="polite">
  <span class="sr-only">Loading search results...</span>
</div>
```

### Error Messages
```html
<form>
  <div role="group" aria-labelledby="email-label" aria-describedby="email-error">
    <label id="email-label">Email</label>
    <input type="email" aria-invalid="true">
    <span id="email-error" role="alert">
      Email must include @ symbol
    </span>
  </div>
</form>
```

## Compliance Report

### Accessibility Statement Template
```markdown
# Accessibility Statement

We are committed to ensuring digital accessibility for all users.

## Conformance Status
This website conforms to WCAG 2.1 Level AA.

## Compatibility
Tested with:
- Screen readers: JAWS 2021, NVDA 2021, VoiceOver
- Browsers: Chrome, Firefox, Safari, Edge
- Operating systems: Windows, macOS, iOS, Android

## Known Issues
- PDF documents may not be fully accessible
- Some third-party content may not meet standards

## Contact
Report accessibility issues: accessibility@example.com
```

Implement comprehensive accessibility features now, ensure WCAG compliance, and create an inclusive user experience.

## Command Completion

✅ `/accessibility $ARGUMENTS` command complete.

Summary: Implemented WCAG 2.1 AA compliance with screen reader support, keyboard navigation, and inclusive design patterns.