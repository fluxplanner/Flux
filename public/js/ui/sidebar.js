export function initSidebar() {
  const items = document.querySelectorAll('.nav-item, .bnav-item');
  items.forEach((item) => {
    item.style.transition = 'transform 0.15s ease';
    item.addEventListener('mouseenter', () => {
      item.style.transform = 'scale(1.03)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.transform = 'scale(1)';
    });
  });
}
