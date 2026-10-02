'use strict';

document.addEventListener('input', (e) => {
    const input = e.target;
    if (input.tagName !== 'INPUT') return;

    const identificador = (input.id + ' ' + (input.name || '')).toLowerCase();

    if (identificador.includes('precio')) {
        const limpio = input.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
        if (limpio !== input.value) input.value = limpio;
    } else if (['telefono', 'cantidad', 'llenas', 'vacias'].some((k) => identificador.includes(k))) {
        const limpio = input.value.replace(/\D/g, '');
        if (limpio !== input.value) input.value = limpio;
    } else if (identificador.includes('nombre') && !identificador.includes('usuario')) {
        const limpio = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        if (limpio !== input.value) input.value = limpio;
    }
});

function initValidacionPassword() {
    const passwordInput = $('nueva-pass');
    const errorPassword = $('error-password');
    const formUsuario = $('form-usuario');
    if (!passwordInput || !errorPassword) return;

    const regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    passwordInput.addEventListener('input', () => {
        const valor = passwordInput.value;
        if (valor === '') {
            errorPassword.style.display = 'none';
            passwordInput.style.borderColor = '';
        } else if (!regexPassword.test(valor)) {
            errorPassword.textContent = 'Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un carácter especial.';
            errorPassword.style.display = 'block';
            passwordInput.style.borderColor = '#e74c3c';
        } else {
            errorPassword.style.display = 'none';
            passwordInput.style.borderColor = '#27ae60';
        }
    });

    if (formUsuario) {
        formUsuario.addEventListener('submit', (e) => {
            if (!regexPassword.test(passwordInput.value)) {
                e.preventDefault();
                errorPassword.textContent = 'La contraseña no cumple con los requisitos de seguridad.';
                errorPassword.style.display = 'block';
                passwordInput.style.borderColor = '#e74c3c';
                passwordInput.focus();
            }
        });
    }
}