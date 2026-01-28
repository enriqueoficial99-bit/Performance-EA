function toggleMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('active');
}

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('mobileMenu');
    const icon = document.querySelector('.mobile-menu-icon');
    
    // Check if the click happened outside the menu and the toggle icon
    if (!menu.contains(event.target) && !icon.contains(event.target) && menu.classList.contains('active')) {
        menu.classList.remove('active');
    }
});
