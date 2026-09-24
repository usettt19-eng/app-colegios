#!/usr/bin/env bash
# diagnostico-servidor.sh
#
# Revisa si el servidor tiene capacidad para Claude Code + codebase-memory-mcp
# + Remote Control, teniendo en cuenta lo que ya está corriendo.
#
# SOLO LEE información: no instala, no cambia ni reinicia nada.
#
# Uso (como root para ver todos los procesos y puertos):
#   bash diagnostico-servidor.sh 2>&1 | tee diagnostico.txt
#
# Luego comparte el contenido de diagnostico.txt.

set -uo pipefail

seccion() { printf '\n===== %s =====\n' "$*"; }
hay() { command -v "$1" >/dev/null 2>&1; }

seccion "Sistema"
echo "Fecha:       $(date -Is)"
echo "Host:        $(hostname)"
[ -r /etc/os-release ] && echo "SO:          $(. /etc/os-release; echo "$PRETTY_NAME")"
echo "Kernel:      $(uname -r)"
echo "Arquitectura: $(uname -m)"
echo "glibc:       $(ldd --version 2>/dev/null | head -1 || echo '?')"
echo "Virtualiz.:  $(systemd-detect-virt 2>/dev/null || echo '?')"
echo "Encendido:   $(uptime -p 2>/dev/null || uptime)"

seccion "CPU y carga"
echo "Núcleos:     $(nproc)"
grep -m1 'model name' /proc/cpuinfo 2>/dev/null | sed 's/.*: /Modelo:      /'
echo "Carga (1/5/15 min): $(cut -d' ' -f1-3 /proc/loadavg)"

seccion "Memoria"
free -h
grep -E 'MemTotal|MemAvailable|SwapTotal|SwapFree' /proc/meminfo

seccion "Disco"
df -h -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -h
echo
echo "Uso por carpeta en /root y /home (puede tardar un poco):"
du -sh /root/* /home/* 2>/dev/null | sort -rh | head -20

seccion "Procesos que más memoria usan"
ps -eo pid,user,%mem,rss,%cpu,etime,comm --sort=-rss | head -15

seccion "Procesos que más CPU usan"
ps -eo pid,user,%cpu,%mem,etime,comm --sort=-%cpu | head -10

seccion "Servicios systemd en ejecución"
if hay systemctl; then
    systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | awk '{print $1}'
fi

seccion "Puertos escuchando"
if hay ss; then ss -tulpn 2>/dev/null; elif hay netstat; then netstat -tulpn 2>/dev/null; fi

seccion "Docker"
if hay docker; then
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null
    docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>/dev/null
else
    echo "Docker no instalado."
fi

seccion "PM2"
if hay pm2; then pm2 list 2>/dev/null; else echo "PM2 no instalado."; fi

seccion "Herramientas y versiones"
for c in node npm python3 git tmux rsync curl nginx apache2 mysql psql redis-server docker pm2 claude codebase-memory-mcp; do
    if hay "$c"; then
        if [ "$c" = tmux ]; then v="$(tmux -V 2>&1)"; else v="$("$c" --version 2>&1 | head -1)"; fi
        [ -z "$v" ] && v="$("$c" -v 2>&1 | head -1)"
        printf '%-22s %s\n' "$c" "$v"
    else
        printf '%-22s %s\n' "$c" "(no instalado)"
    fi
done
for d in /root/.local/bin /home/*/.local/bin; do
    for c in claude codebase-memory-mcp; do
        [ -x "$d/$c" ] && echo "Encontrado: $d/$c"
    done
done

seccion "Salida a internet (necesaria para instalar y para Claude)"
for url in https://claude.ai https://api.anthropic.com https://github.com https://raw.githubusercontent.com; do
    code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url" 2>/dev/null)"
    printf '%-38s HTTP %s\n' "$url" "${code:-sin respuesta}"
done

seccion "Evaluación rápida"
cores=$(nproc)
mem_total_mb=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
mem_avail_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/{print int($2/1024)}' /proc/meminfo)
disk_free_gb=$(df -Pk "${HOME:-/root}" | awk 'NR==2{print int($4/1024/1024)}')
load1=$(cut -d' ' -f1 /proc/loadavg)

# Estimación aproximada: cada sesión de Claude Code (Node) ~400-600 MB,
# codebase-memory-mcp ~100-300 MB en reposo (más mientras indexa repos grandes).
echo "RAM total ${mem_total_mb} MB | disponible ${mem_avail_mb} MB | swap ${swap_mb} MB"
echo "Disco libre en ${HOME:-/root}: ${disk_free_gb} GB | núcleos: ${cores} | carga 1 min: ${load1}"
echo

if   [ "$mem_avail_mb" -ge 3000 ]; then echo "[OK]    RAM disponible holgada: caben varias sesiones de Remote Control."
elif [ "$mem_avail_mb" -ge 1500 ]; then echo "[JUSTO] RAM disponible para 1-2 sesiones a la vez. Evita tener muchas corriendo."
else                                     echo "[POCO]  Menos de 1.5 GB libres: Claude podría competir con tus apps. Agrega swap o más RAM."
fi
if [ "$swap_mb" -lt 1024 ]; then
    echo "[AVISO] Sin swap (o muy poca). Recomendado agregar 2 GB de swap como colchón."
fi
if   [ "$disk_free_gb" -ge 10 ]; then echo "[OK]    Disco suficiente."
elif [ "$disk_free_gb" -ge 3 ];  then echo "[JUSTO] Disco ajustado; los índices y copias de proyectos ocupan espacio."
else                                   echo "[POCO]  Menos de 3 GB libres: libera espacio antes de instalar."
fi
if awk -v l="$load1" -v c="$cores" 'BEGIN{exit !(l > c*0.8)}'; then
    echo "[AVISO] La CPU ya está bastante ocupada (carga ${load1} con ${cores} núcleos)."
else
    echo "[OK]    CPU con margen."
fi
