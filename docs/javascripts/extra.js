// NextSight AI Documentation - Extra JavaScript

// Add smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Add copy feedback for code blocks
document.addEventListener('DOMContentLoaded', function() {
  // Check for clipboard button clicks
  document.querySelectorAll('.md-clipboard').forEach(button => {
    button.addEventListener('click', function() {
      const originalTitle = this.getAttribute('title');
      this.setAttribute('title', 'Copied!');
      setTimeout(() => {
        this.setAttribute('title', originalTitle);
      }, 2000);
    });
  });
});

// Console welcome message
console.log('%c NextSight AI ', 'background: #7c3aed; color: white; font-size: 16px; padding: 8px 16px; border-radius: 4px;');
console.log('%c AI-powered Kubernetes Management ', 'color: #06b6d4; font-size: 12px;');
