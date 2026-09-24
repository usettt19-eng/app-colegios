#!/usr/bin/env bash
# instalar-claude-servidor.sh
#
# Instala en un servidor Linux (Ubuntu/Debian):
#   - Claude Code
#   - codebase-memory-mcp, conectado a Claude Code como servidor MCP
#   - un servicio systemd por proyecto que deja "claude remote-control"
#     corriendo dentro de tmux, para manejarlo desde claude.ai/code o el celular
#
# Uso (como root):
#   bash instalar-claude-servidor.sh [--usuario NOMBRE] RUTA_PROYECTO [RUTA_PROYECTO ...]
#
# Ejemplos:
#   bash instalar-claude-servidor.sh /root/pptx-Narrador
#   bash instalar-claude-servidor.sh --usuario root /root/pptx-Narrador /root/otro
#
# Por defecto crea el usuario "claude". Los proyectos que ese usuario no
# puede leer (por ejemplo los que están en /root) se COPIAN a
# /home/claude/proyectos/<nombre>. Con --usuario root se usan en su lugar.
#
# Se puede correr varias veces: lo que ya está instalado se reutiliza.

set -euo pipefail

USUARIO="claude"
PROYECTOS=()

while [ $# -gt 0 ]; do
    case "$1" in
        --usuario)
            USUARIO="${2:?falta el nombre después de --usuario}"
            shift 2
            ;;
        --usuario=*)
            USUARIO="${1#--usuario=}"
            shift
            ;;
        -h|--help)
            sed -n '2,21p' "$0"
            exit 0
            ;;
        -*)
            echo "Opción desconocida: $1" >&2
            exit 1
            ;;
        *)
            PROYECTOS+=("$1")
            shift
            ;;
    esac
done

paso() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Córrelo como root (sudo bash $0 ...)."
[ ${#PROYECTOS[@]} -gt 0 ] || error "Indica al menos una carpeta de proyecto. Ejemplo: bash $0 /root/pptx-Narrador"
[[ "$USUARIO" =~ ^[a-z_][a-z0-9_-]*$ ]] || error "Nombre de usuario no válido: $USUARIO"

como_usuario() {
    # Corre un comando como $USUARIO con su HOME y PATH (incluye ~/.local/bin).
    if [ "$USUARIO" = "root" ]; then
        HOME=/root PATH="/root/.local/bin:$PATH" bash -lc "$1"
    else
        su - "$USUARIO" -c "export PATH=\"\$HOME/.local/bin:\$PATH\"; $1"
    fi
}

# ---------------------------------------------------------------------------
paso "1/6 Instalando paquetes base (curl, git, tmux, rsync)"
if command -v apt-get >/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates git tmux rsync >/dev/null
elif command -v dnf >/dev/null; then
    dnf install -y -q curl ca-certificates git tmux rsync
else
    for c in curl git tmux rsync; do
        command -v "$c" >/dev/null || error "Falta '$c' y no reconozco el gestor de paquetes. Instálalo y vuelve a correr."
    done
fi

# ---------------------------------------------------------------------------
paso "2/6 Preparando el usuario '$USUARIO'"
if [ "$USUARIO" = "root" ]; then
    HOME_USUARIO=/root
else
    if id "$USUARIO" >/dev/null 2>&1; then
        echo "El usuario ya existe."
    else
        useradd --create-home --shell /bin/bash "$USUARIO"
        echo "Usuario creado."
    fi
    HOME_USUARIO="$(getent passwd "$USUARIO" | cut -d: -f6)"

    # Permite entrar por SSH directo como este usuario con la misma llave de root.
    if [ -f /root/.ssh/authorized_keys ] && [ ! -f "$HOME_USUARIO/.ssh/authorized_keys" ]; then
        install -d -m 700 -o "$USUARIO" -g "$USUARIO" "$HOME_USUARIO/.ssh"
        install -m 600 -o "$USUARIO" -g "$USUARIO" /root/.ssh/authorized_keys "$HOME_USUARIO/.ssh/authorized_keys"
        echo "Copiada la llave SSH de root: puedes entrar con ssh -i <tu .pem> $USUARIO@<servidor>"
    fi
fi
BIN_DIR="$HOME_USUARIO/.local/bin"

# ---------------------------------------------------------------------------
paso "3/6 Instalando Claude Code"
if [ -x "$BIN_DIR/claude" ]; then
    echo "Ya estaba instalado: $(como_usuario 'claude --version' 2>/dev/null || echo '?')"
else
    como_usuario 'curl -fsSL https://claude.ai/install.sh | bash'
fi
[ -x "$BIN_DIR/claude" ] || error "No encontré $BIN_DIR/claude después de instalar."
como_usuario 'grep -q ".local/bin" ~/.bashrc 2>/dev/null || echo '"'"'export PATH="$HOME/.local/bin:$PATH"'"'"' >> ~/.bashrc'

# ---------------------------------------------------------------------------
paso "4/6 Instalando codebase-memory-mcp"
if [ -x "$BIN_DIR/codebase-memory-mcp" ]; then
    echo "Ya estaba instalado: $(como_usuario 'codebase-memory-mcp --version' 2>/dev/null || echo '?')"
else
    # --skip-config: la conexión con Claude Code la hacemos abajo de forma explícita.
    como_usuario 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --skip-config'
fi
[ -x "$BIN_DIR/codebase-memory-mcp" ] || error "No encontré $BIN_DIR/codebase-memory-mcp después de instalar."

if como_usuario 'claude mcp list' 2>/dev/null | grep -q '^codebase-memory'; then
    echo "El MCP 'codebase-memory' ya estaba conectado a Claude Code."
else
    como_usuario "claude mcp add --scope user codebase-memory -- '$BIN_DIR/codebase-memory-mcp'"
    echo "MCP 'codebase-memory' agregado a Claude Code (para todos los proyectos de $USUARIO)."
fi

# ---------------------------------------------------------------------------
paso "5/6 Preparando e indexando proyectos"
DIRS_FINALES=()
NOMBRES=()
for ORIGEN in "${PROYECTOS[@]}"; do
    ORIGEN="$(realpath "$ORIGEN" 2>/dev/null)" || error "No existe la carpeta: $ORIGEN"
    [ -d "$ORIGEN" ] || error "No es una carpeta: $ORIGEN"
    NOMBRE="$(basename "$ORIGEN")"
    [[ "$NOMBRE" =~ ^[A-Za-z0-9._-]+$ ]] || error "El nombre '$NOMBRE' tiene caracteres raros; renombra la carpeta (solo letras, números, . _ -)."

    if [ "$USUARIO" = "root" ] || su - "$USUARIO" -c "test -r '$ORIGEN' -a -w '$ORIGEN' -a -x '$ORIGEN'"; then
        DESTINO="$ORIGEN"
    else
        DESTINO="$HOME_USUARIO/proyectos/$NOMBRE"
        if [ -e "$DESTINO" ]; then
            aviso "$DESTINO ya existe; no lo sobrescribo. Bórralo si quieres copiar de nuevo desde $ORIGEN."
        else
            install -d -o "$USUARIO" -g "$USUARIO" "$HOME_USUARIO/proyectos"
            rsync -a "$ORIGEN/" "$DESTINO/"
            chown -R "$USUARIO:$USUARIO" "$DESTINO"
            aviso "Copiado $ORIGEN -> $DESTINO. Es una COPIA: Claude trabajará sobre $DESTINO, no sobre el original."
        fi
    fi

    echo "Indexando $DESTINO ..."
    como_usuario "codebase-memory-mcp cli index_repository --repo-path '$DESTINO'"
    DIRS_FINALES+=("$DESTINO")
    NOMBRES+=("$NOMBRE")
done
como_usuario 'codebase-memory-mcp cli list_projects' || true

# ---------------------------------------------------------------------------
paso "6/6 Creando servicios de Remote Control (systemd + tmux)"
TMUX_BIN="$(command -v tmux)"
install -d /etc/claude-rc
for i in "${!NOMBRES[@]}"; do
    printf 'DIR=%s\n' "${DIRS_FINALES[$i]}" > "/etc/claude-rc/${NOMBRES[$i]}.conf"
done

cat > /etc/systemd/system/claude-rc@.service <<EOF
[Unit]
Description=Claude Code Remote Control para el proyecto %i
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=$USUARIO
EnvironmentFile=/etc/claude-rc/%i.conf
Environment=PATH=$BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=$TMUX_BIN new-session -d -s rc-%i -c \${DIR} $BIN_DIR/claude remote-control
ExecStop=$TMUX_BIN kill-session -t rc-%i
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

if [ -d /run/systemd/system ]; then
    systemctl daemon-reload
    echo "Servicio 'claude-rc@' instalado (todavía NO arrancado: primero hay que iniciar sesión)."
else
    aviso "systemd no está activo en esta máquina; el servicio quedó escrito pero no se puede usar aquí."
fi

# ---------------------------------------------------------------------------
if [ "$USUARIO" = "root" ]; then ENTRAR="(ya eres root)"; else ENTRAR="su - $USUARIO"; fi
cat <<EOF

========================================================================
 Instalación terminada. Faltan dos pasos que requieren tu intervención:
========================================================================

 1) Iniciar sesión en Claude (una sola vez):

      $ENTRAR
      cd ${DIRS_FINALES[0]}
      claude
      # Elige iniciar sesión con tu cuenta, abre el enlace en tu PC,
      # autoriza y pega el código. Acepta confiar en la carpeta.
      # Prueba: /mcp  -> debe aparecer "codebase-memory" conectado.
      # Sal con /exit

 2) Probar Remote Control a mano una vez (acepta lo que pregunte):

      claude remote-control
      # Debe aparecer la sesión en claude.ai/code. Ctrl+C para salir.
      exit    # volver a root

 3) Dejarlo corriendo siempre (arranca también al reiniciar el servidor):

EOF
for NOMBRE in "${NOMBRES[@]}"; do
    echo "      systemctl enable --now claude-rc@$NOMBRE"
done
cat <<EOF

 Útil después:
   Ver estado:          systemctl status claude-rc@${NOMBRES[0]}
   Ver la terminal:     su - $USUARIO -c 'tmux attach -t rc-${NOMBRES[0]}'   (salir: Ctrl+B y luego D)
   Reiniciar:           systemctl restart claude-rc@${NOMBRES[0]}
   Reindexar:           su - $USUARIO -c 'codebase-memory-mcp cli index_repository --repo-path ${DIRS_FINALES[0]}'
   Agregar proyecto:    vuelve a correr este script con la nueva carpeta.
EOF
