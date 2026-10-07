// El fetch corre en el navegador, por eso se usa localhost y el puerto expuesto de la API.
    const API = 'http://localhost:3000';

    const ENTIDADES = {
      categorias: {
        titulo: 'Categorías', singular: 'categoría',
        campos: [
          { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true },
          { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'text' }
        ]
      },
      clientes: {
        titulo: 'Clientes', singular: 'cliente',
        campos: [
          { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true },
          { nombre: 'email', etiqueta: 'Email', tipo: 'email', requerido: true },
          { nombre: 'ciudad', etiqueta: 'Ciudad', tipo: 'text' }
        ]
      },
      productos: {
        titulo: 'Productos', singular: 'producto',
        campos: [
          { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true },
          { nombre: 'precio', etiqueta: 'Precio', tipo: 'number', paso: '0.01', requerido: true },
          { nombre: 'stock', etiqueta: 'Stock', tipo: 'number', paso: '1' },
          { nombre: 'categoria_id', etiqueta: 'Categoría', tipo: 'select', ref: 'categorias', requerido: true }
        ]
      },
      pedidos: {
        titulo: 'Pedidos', singular: 'pedido',
        campos: [
          { nombre: 'cliente_id', etiqueta: 'Cliente', tipo: 'select', ref: 'clientes', requerido: true },
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ['pendiente', 'enviado', 'entregado', 'cancelado'] }
        ]
      }
    };

    let actual = 'inicio';
    let editandoId = null;
    let filtro = '';
    const datos = {};

    document.getElementById('api-url').textContent = API;

    // ---------- utilidades ----------
    function esc(valor) {
      return String(valor ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
      ));
    }

    // La API puede devolver una lista directa o un objeto que la contiene.
    function extraerLista(respuesta) {
      if (Array.isArray(respuesta)) return respuesta;
      if (respuesta && typeof respuesta === 'object') {
        for (const valor of Object.values(respuesta)) {
          if (Array.isArray(valor)) return valor;
        }
      }
      return [];
    }

    async function api(ruta, metodo = 'GET', cuerpo = null) {
      const opciones = { method: metodo };
      if (cuerpo) {
        opciones.headers = { 'Content-Type': 'application/json' };
        opciones.body = JSON.stringify(cuerpo);
      }
      const resp = await fetch(API + ruta, opciones);
      let json = null;
      try { json = await resp.json(); } catch (e) { /* respuesta sin cuerpo */ }
      if (!resp.ok) {
        const msg = json && (json.error || json.mensaje || json.message || json.detalle);
        throw new Error(msg || `Error ${resp.status}`);
      }
      return json;
    }

    function avisar(texto, tipo = 'ok') {
      const caja = document.getElementById('aviso');
      caja.textContent = texto;
      caja.className = tipo;
      clearTimeout(avisar.t);
      avisar.t = setTimeout(() => { caja.className = ''; }, 3800);
    }

    async function cargar(entidad) {
      datos[entidad] = extraerLista(await api('/' + entidad));
    }

    function nombrePorId(entidad, id) {
      const item = (datos[entidad] || []).find(x => String(x.id) === String(id));
      return item ? `${item.nombre} (#${id})` : id;
    }

    // ---------- navegación lateral y tarjetas ----------
    function pintarNavegacion() {
      const nav = document.getElementById('pestanas');
      nav.innerHTML = `
        <button data-entidad="inicio" class="${actual === 'inicio' ? 'activo' : ''}">
          <span>Inicio</span><span>✦</span>
        </button>` + Object.entries(ENTIDADES).map(([clave, cfg]) => `
        <button data-entidad="${clave}" class="${clave === actual ? 'activo' : ''}">
          <span>${cfg.titulo}</span>
          <span class="contador">${(datos[clave] || []).length}</span>
        </button>`
      ).join('');

      const stats = document.getElementById('stats');
      stats.innerHTML = Object.entries(ENTIDADES).map(([clave, cfg]) => `
        <button class="stat ${clave === actual ? 'activo' : ''}" data-entidad="${clave}">
          <div class="numero">${(datos[clave] || []).length}</div>
          <div class="nombre">${cfg.titulo}</div>
        </button>`
      ).join('');
    }

    // Un solo manejador para todos los botones que llevan a una sección (menú, tarjetas, "Ver todos").
    document.addEventListener('click', e => {
      const boton = e.target.closest('[data-entidad]');
      if (boton) cambiarEntidad(boton.dataset.entidad);
    });

    function cambiarEntidad(entidad) {
      actual = entidad;
      editandoId = null;
      filtro = '';
      document.getElementById('buscar').value = '';
      cerrarPanel();
      pintarTodo();
    }

    async function refrescar() {
      try {
        await Promise.all(Object.keys(ENTIDADES).map(cargar));
      } catch (e) {
        avisar('No se pudo cargar la información: ' + e.message, 'error');
      }
      pintarTodo();
    }

    function pintarTodo() {
      const esInicio = actual === 'inicio';
      document.getElementById('hero').classList.toggle('oculto', !esInicio);
      document.getElementById('paneles').classList.toggle('oculto', !esInicio);
      document.getElementById('vista-tabla').classList.toggle('oculto', esInicio);
      document.getElementById('btn-nuevo').classList.toggle('oculto', esInicio);
      document.getElementById('tabla-titulo').textContent = esInicio ? 'Inicio' : ENTIDADES[actual].titulo;
      pintarNavegacion();

      if (esInicio) {
        pintarInicio();
      } else {
        document.getElementById('btn-nuevo').textContent = `+ Nuevo ${ENTIDADES[actual].singular}`;
        pintarTabla();
      }
    }

    // ---------- vista de inicio ----------
    function dinero(valor) {
      const n = Number(valor);
      return isNaN(n) ? valor : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    }

    function pintarInicio() {
      document.getElementById('hero-fecha').textContent = new Date().toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });

      // Últimos 5 pedidos, del más reciente al más antiguo
      const pedidos = [...(datos.pedidos || [])].sort((a, b) => b.id - a.id).slice(0, 5);
      const colFecha = pedidos[0] && Object.keys(pedidos[0]).find(k => /fecha|creado|created/i.test(k));
      document.getElementById('ultimos-pedidos').innerHTML = pedidos.length === 0
        ? '<p class="vacio">No hay pedidos todavía.</p>'
        : `<table>
            <thead><tr><th>#</th><th>Cliente</th><th>Estado</th>${colFecha ? '<th>Fecha</th>' : ''}</tr></thead>
            <tbody>${pedidos.map(p => `
              <tr>
                <td>${esc(p.id)}</td>
                <td>${esc(nombrePorId('clientes', p.cliente_id))}</td>
                <td><span class="pill ${esc(String(p.estado || '').toLowerCase())}">${esc(p.estado || '—')}</span></td>
                ${colFecha ? `<td>${esc(String(p[colFecha]).slice(0, 10))}</td>` : ''}
              </tr>`).join('')}
            </tbody>
          </table>`;

      // 5 productos con menos unidades disponibles
      const productos = [...(datos.productos || [])]
        .sort((a, b) => Number(a.stock ?? 0) - Number(b.stock ?? 0))
        .slice(0, 5);
      document.getElementById('poco-stock').innerHTML = productos.length === 0
        ? '<p class="vacio">No hay productos todavía.</p>'
        : `<table>
            <thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio</th></tr></thead>
            <tbody>${productos.map(p => `
              <tr>
                <td>${esc(p.nombre)}</td>
                <td>${esc(nombrePorId('categorias', p.categoria_id))}</td>
                <td class="${Number(p.stock) <= 5 ? 'stock-bajo' : ''}">${esc(p.stock ?? 0)}</td>
                <td>${esc(dinero(p.precio))}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
    }

    // ---------- panel del formulario ----------
    function abrirPanel(registro = null) {
      pintarFormulario(registro);
      document.body.classList.add('panel-abierto');
      document.getElementById('panel').setAttribute('aria-hidden', 'false');
      const primero = document.querySelector('#formulario input, #formulario select');
      if (primero) setTimeout(() => primero.focus(), 300);
    }

    function cerrarPanel() {
      document.body.classList.remove('panel-abierto');
      document.getElementById('panel').setAttribute('aria-hidden', 'true');
      editandoId = null;
    }

    document.getElementById('btn-nuevo').addEventListener('click', () => { editandoId = null; abrirPanel(); });
    document.getElementById('cerrar').addEventListener('click', cerrarPanel);
    document.getElementById('fondo-panel').addEventListener('click', cerrarPanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarPanel(); });

    function pintarFormulario(registro = null) {
      const cfg = ENTIDADES[actual];
      document.getElementById('form-titulo').textContent =
        editandoId ? `Editar ${cfg.singular} #${editandoId}` : `Nuevo ${cfg.singular}`;

      const form = document.getElementById('formulario');
      form.innerHTML = cfg.campos.map(campo => {
        const valor = registro ? registro[campo.nombre] : '';
        const req = campo.requerido ? 'required' : '';
        const marca = campo.requerido ? ' *' : '';

        if (campo.opciones) {
          const opciones = campo.opciones.map(op =>
            `<option value="${op}" ${op === String(valor || 'pendiente') ? 'selected' : ''}>${op.charAt(0).toUpperCase() + op.slice(1)}</option>`
          ).join('');
          return `<label for="${campo.nombre}">${campo.etiqueta}${marca}</label>
                  <select id="${campo.nombre}" name="${campo.nombre}" ${req}>${opciones}</select>`;
        }

        if (campo.tipo === 'select') {
          const opciones = (datos[campo.ref] || []).map(item =>
            `<option value="${esc(item.id)}" ${String(item.id) === String(valor) ? 'selected' : ''}>${esc(item.nombre)} (#${esc(item.id)})</option>`
          ).join('');
          return `<label for="${campo.nombre}">${campo.etiqueta}${marca}</label>
                  <select id="${campo.nombre}" name="${campo.nombre}" ${req}>
                    <option value="">Selecciona…</option>${opciones}
                  </select>`;
        }

        let lista = '';
        if (campo.sugerencias) {
          const valores = [...new Set((datos[actual] || []).map(x => x[campo.nombre]).filter(Boolean))];
          lista = `<datalist id="lista-${campo.nombre}">${valores.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
        }
        return `<label for="${campo.nombre}">${campo.etiqueta}${marca}</label>
                <input id="${campo.nombre}" name="${campo.nombre}" type="${campo.tipo}"
                       ${campo.paso ? `step="${campo.paso}" min="0"` : ''}
                       ${campo.sugerencias ? `list="lista-${campo.nombre}"` : ''}
                       value="${esc(valor)}" ${req}>${lista}`;
      }).join('') + `
        <div class="botones">
          <button type="submit" class="principal">${editandoId ? 'Guardar cambios' : 'Crear'}</button>
          <button type="button" class="secundario" id="cancelar">Cancelar</button>
        </div>`;

      document.getElementById('cancelar').addEventListener('click', cerrarPanel);
    }

    document.getElementById('formulario').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const cfg = ENTIDADES[actual];
      const cuerpo = {};

      for (const campo of cfg.campos) {
        const valor = document.getElementById(campo.nombre).value.trim();
        if (valor === '') continue;
        if (campo.ref || campo.paso === '1') cuerpo[campo.nombre] = parseInt(valor, 10);
        else if (campo.tipo === 'number') cuerpo[campo.nombre] = parseFloat(valor);
        else cuerpo[campo.nombre] = valor;
      }

      try {
        if (editandoId) {
          await api(`/${actual}/${editandoId}`, 'PUT', cuerpo);
          avisar(`${cfg.singular} #${editandoId} actualizado`);
        } else {
          await api(`/${actual}`, 'POST', cuerpo);
          avisar(`${cfg.singular} creado correctamente`);
        }
        cerrarPanel();
        await refrescar();
      } catch (e) {
        avisar('Error: ' + e.message, 'error');
      }
    });

    // ---------- tabla ----------
    document.getElementById('buscar').addEventListener('input', e => {
      filtro = e.target.value.trim().toLowerCase();
      pintarTabla();
    });

    function pintarTabla() {
      const cfg = ENTIDADES[actual];
      const todas = datos[actual] || [];
      const refs = Object.fromEntries(cfg.campos.filter(c => c.ref).map(c => [c.nombre, c.ref]));
      const textoCelda = (fila, col) => refs[col] ? nombrePorId(refs[col], fila[col]) : fila[col];

      const filas = filtro
        ? todas.filter(f => Object.keys(f).some(col => String(textoCelda(f, col) ?? '').toLowerCase().includes(filtro)))
        : todas;

      document.getElementById('resumen').textContent = filtro
        ? `${filas.length} de ${todas.length} registros`
        : `${todas.length} registros`;

      const contenedor = document.getElementById('tabla');
      if (filas.length === 0) {
        contenedor.innerHTML = `<p class="vacio">${filtro ? 'Ningún registro coincide con la búsqueda.' : 'No hay registros todavía.'}</p>`;
        return;
      }

      const columnas = Object.keys(todas[0]);
      const encabezado = columnas.map(c => `<th>${esc(c.replace(/_/g, ' '))}</th>`).join('') + '<th>Acciones</th>';
      const cuerpo = filas.map(fila => {
        const celdas = columnas.map(col => `<td>${esc(textoCelda(fila, col))}</td>`).join('');
        return `<tr>${celdas}
          <td>
            <button class="mini editar" data-id="${esc(fila.id)}">Editar</button>
            <button class="mini borrar" data-id="${esc(fila.id)}">Eliminar</button>
          </td></tr>`;
      }).join('');

      contenedor.innerHTML = `<table><thead><tr>${encabezado}</tr></thead><tbody>${cuerpo}</tbody></table>`;

      contenedor.querySelectorAll('.editar').forEach(b => b.addEventListener('click', () => {
        editandoId = b.dataset.id;
        abrirPanel(todas.find(f => String(f.id) === editandoId));
      }));

      contenedor.querySelectorAll('.borrar').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar ${cfg.singular} #${b.dataset.id}?`)) return;
        try {
          await api(`/${actual}/${b.dataset.id}`, 'DELETE');
          avisar(`${cfg.singular} #${b.dataset.id} eliminado`);
          await refrescar();
        } catch (e) {
          // Si otros registros apuntan a este (clave foránea), se muestra un mensaje claro.
          const esLlave = /foreign|llave|clave|referen|constraint|viola|depend|asociad/i.test(e.message);
          avisar(esLlave
            ? `No se puede eliminar ${cfg.singular} #${b.dataset.id}: tiene registros asociados en otra tabla. Elimina o cambia primero esos registros.`
            : 'No se pudo eliminar: ' + e.message, 'error');
        }
      }));
    }

    // ---------- estado de la API ----------
    async function verificarApi() {
      const etiqueta = document.getElementById('estado-api');
      try {
        await api('/health');
        etiqueta.textContent = '● API conectada';
        etiqueta.style.background = 'rgba(255,111,163,.35)';
      } catch (e) {
        etiqueta.textContent = '● API sin conexión';
        etiqueta.style.background = 'rgba(179,18,47,.9)';
      }
    }

    verificarApi();
    refrescar();