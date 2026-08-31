// ==========================================
// LÓGICA DE CLIENTES
// ==========================================
if (document.getElementById('cuerpo-tabla-clientes')) {
    function cargarClientes() {
        fetch('/api/clientes')
            .then(res => res.json())
            .then(clientes => {
                const tbody = document.getElementById('cuerpo-tabla-clientes');
                tbody.innerHTML = '';
                clientes.forEach(c => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${c.nombre}</strong></td>
                            <td>${c.telefono}</td>
                            <td>${c.direccion || '-'}</td>
                            <td>
                                <button class="btn-accion btn-eliminar" onclick="borrarCliente(${c.id})">Borrar</button>
                            </td>
                        </tr>
                    `;
                });
            });
    }

    function abrirModalCliente() { 
        document.getElementById('modal-cliente').style.display = 'flex'; 
    }
    
    function cerrarModalCliente() { 
        document.getElementById('modal-cliente').style.display = 'none'; 
    }

    document.getElementById('form-cliente').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            nombre: document.getElementById('cliente-nombre').value,
            telefono: document.getElementById('cliente-telefono').value,
            direccion: document.getElementById('cliente-direccion').value
        };
        fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            cerrarModalCliente();
            document.getElementById('form-cliente').reset();
            cargarClientes();
        });
    });

    function borrarCliente(id) {
        if (confirm("¿Estás seguro de borrar este cliente?")) {
            fetch(`/api/clientes/${id}`, { method: 'DELETE' }).then(() => cargarClientes());
        }
    }

    cargarClientes();
}

// ==========================================
// LÓGICA DE STOCK
// ==========================================
if (document.getElementById('cuerpo-tabla-stock')) {
    function cargarStock() {
        fetch('/api/stock')
            .then(res => res.json())
            .then(stock => {
                const tbody = document.getElementById('cuerpo-tabla-stock');
                tbody.innerHTML = '';
                stock.forEach(s => {
                    const totalFisico = s.llenas + s.vacias;
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>Garrafa de ${s.tipo}</strong></td>
                            <td style="color: #27ae60; font-weight: bold;">${s.llenas}</td>
                            <td style="color: #e67e22; font-weight: bold;">${s.vacias}</td>
                            <td>$${s.precio}</td>
                            <td>${totalFisico}</td>
                            <td>
                                <button class="btn-accion btn-editar" onclick="abrirModalStock('${s.tipo}', ${s.llenas}, ${s.vacias}, ${s.precio})">Editar</button>
                            </td>
                        </tr>
                    `;
                });
            });
    }

    function abrirModalStock(tipo, llenas, vacias, precio) {
        document.getElementById('titulo-modal-stock').textContent = "Editar Stock - Garrafa de " + tipo;
        document.getElementById('stock-tipo').value = tipo;
        document.getElementById('stock-llenas').value = llenas;
        document.getElementById('stock-vacias').value = vacias;
        document.getElementById('stock-precio').value = precio;
        document.getElementById('modal-stock').style.display = 'flex';
    }

    function cerrarModalStock() { 
        document.getElementById('modal-stock').style.display = 'none'; 
    }

    document.getElementById('form-stock').addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('stock-tipo').value;
        const data = {
            llenas: parseInt(document.getElementById('stock-llenas').value),
            vacias: parseInt(document.getElementById('stock-vacias').value),
            precio: parseFloat(document.getElementById('stock-precio').value)
        };
        
        fetch(`/api/stock/${tipo}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            cerrarModalStock();
            cargarStock();
        });
    });

    cargarStock();
}