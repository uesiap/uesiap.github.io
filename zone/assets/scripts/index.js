// Shared script for the prayer index page.
// Each page sets window.PRAYER_CONFIG before loading this file.
(function () {
    const CONFIG = window.PRAYER_CONFIG;

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    document.addEventListener('DOMContentLoaded', () => {
        const yearSelect = document.getElementById('year');
        const monthSelect = document.getElementById('month');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Previous, current and next year
        for (let year = currentYear - 1; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }

        // Months
        monthNames.forEach((name, index) => {
            const option = document.createElement('option');
            option.value = index + 1;
            option.textContent = name;
            if (index + 1 === currentMonth) option.selected = true;
            monthSelect.appendChild(option);
        });
    });

    document.getElementById('selectionForm').addEventListener('submit', function (event) {
        event.preventDefault();

        const year = document.getElementById('year').value;
        const month = document.getElementById('month').value;
        const errorMessage = document.getElementById('error-message');

        if (!year || !month) {
            errorMessage.textContent = 'Please select year and month.';
            errorMessage.style.display = 'block';
            return;
        }

        const encodedYear = btoa(year);
        const encodedMonth = btoa(month);

        window.location.href =
            `${CONFIG.requestsPath}?utm=${encodeURIComponent(encodedYear)}&auth=${encodeURIComponent(encodedMonth)}`;
    });
})();