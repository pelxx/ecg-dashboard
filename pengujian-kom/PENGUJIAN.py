import csv
import json
import threading
import time
import zipfile
from collections import deque
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from xml.etree import ElementTree as ET
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

try:
    import ntplib
except ImportError:
    ntplib = None

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

try:
    import pandas as pd
except ImportError:
    pd = None

from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.figure import Figure

BASE_DIR = (
    Path(sys.executable).resolve().parent
    if getattr(sys, "frozen", False)
    else Path(__file__).resolve().parent
)

load_dotenv(BASE_DIR / ".env")

BROKER = os.getenv("ECG_MQTT_BROKER", "").strip()
PORT = int(os.getenv("ECG_MQTT_PORT", "0"))
MQTT_PATH = os.getenv("ECG_MQTT_PATH", "").strip()
TOPIC = os.getenv("ECG_MQTT_TOPIC", "").strip()
USERNAME = os.getenv("ECG_MQTT_USERNAME", "")
PASSWORD = os.getenv("ECG_MQTT_PASSWORD", "")
C = {
    # Background
    "bg": "#F0E9D8",
    "side": "#E4DCC8",

    # Panel dan kartu
    "card": "#FBF8F0",
    "card2": "#D8D0BA",
    "border": "#C8C0AA",

    # Teks
    "text": "#292D24",
    "muted": "#777666",

    # Aksen utama: olive
    # Nama key "blue" dipertahankan agar kode lama tetap jalan
    "blue": "#72784B",
    "blue2": "#8A9060",

    # Status
    "green": "#52796F",
    "red": "#B94E4E",
    "yellow": "#B88732",
}

def read_simple_xlsx(path):
    """Read the first worksheet of a conventional .xlsx file without openpyxl."""
    if pd is None:
        raise ImportError("pandas is required for data import")

    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

    with zipfile.ZipFile(path) as workbook:
        shared = []

        if "xl/sharedStrings.xml" in workbook.namelist():
            shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared = [
                "".join(item.itertext())
                for item in shared_root.findall(f"{ns}si")
            ]

        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))

    def column_index(reference):
        letters = "".join(char for char in reference if char.isalpha())
        index = 0

        for letter in letters:
            index = index * 26 + ord(letter.upper()) - 64

        return index - 1

    rows = []

    for row in sheet.findall(f".//{ns}row"):
        values = {}

        for cell in row.findall(f"{ns}c"):
            value_node = cell.find(f"{ns}v")
            value = value_node.text if value_node is not None else ""

            if cell.get("t") == "s" and value:
                value = shared[int(value)]
            elif cell.get("t") == "inlineStr":
                value = "".join(cell.itertext())

            values[column_index(cell.get("r", "A1"))] = value

        if values:
            rows.append(
                [values.get(index, "") for index in range(max(values) + 1)]
            )

    if len(rows) < 2:
        raise ValueError("The selected workbook has no data rows.")

    width = max(map(len, rows))
    rows = [row + [""] * (width - len(row)) for row in rows]
    headers = [
        str(value).strip() or f"Column {index + 1}"
        for index, value in enumerate(rows[0])
    ]
    frame = pd.DataFrame(rows[1:], columns=headers)

    for column in frame.columns:
        numeric = pd.to_numeric(frame[column], errors="coerce")

        if numeric.notna().sum() == frame[column].replace("", float("nan")).notna().sum():
            frame[column] = numeric

    return frame


class ECGTestingTool(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Pengujian Telemetri ECG")
        self.geometry("1200x750")
        self.minsize(1000, 650)
        self.configure(bg=C["bg"])

        self.client = None
        self.testing = False
        self.ntp_offset = 0.0
        self.started = None
        self.packets = deque(maxlen=100)
        self.all_packets = []
        self.lock = threading.Lock()
        self.data = None
        self.channel_map = {}

        self._style()
        self._shell()
        self._mqtt_page()
        self._analysis_page()
        self._settings_page()
        self.show("mqtt")
        self.after(500, self._tick)
        self.protocol("WM_DELETE_WINDOW", self.close)

    def _style(self):
        s = ttk.Style(self)
        s.theme_use("clam")     
        s.configure(
            "Light.Treeview",
            background=C["card"],
            fieldbackground=C["card"],
            foreground=C["text"],
            rowheight=28,
            borderwidth=0,
        )

        s.configure(
            "Light.Treeview.Heading",
            background=C["card2"],
            foreground=C["text"],
            font=("Segoe UI", 9, "bold"),
        )

        s.map(
            "Light.Treeview",
            background=[("selected", C["blue"])],
            foreground=[("selected", "#FFFFFF")],
        )

        s.map(
            "Light.Treeview.Heading",
            background=[("active", C["border"])],
        )


    def label(self, parent, text="", size=10, weight="normal", fg=None, **kw):
        return tk.Label(
            parent,
            text=text,
            bg=parent.cget("bg"),
            fg=fg or C["text"],
            font=("Segoe UI", size, weight),
            **kw,
        )

    def button(self, parent, text, command, primary=False, state="normal"):
        bg = C["blue"] if primary else C["card2"]
        active = C["blue2"] if primary else C["border"]
        
        b = tk.Button(
            parent,
            text=text,
            command=command,
            state=state,
            cursor="hand2",
            bg=bg,
            fg = "#FFFFFF" if primary else C["text"],
            activeforeground = "#FFFFFF" if primary else C["text"],
            activebackground=active,
            disabledforeground="#687984",
            relief="flat",
            bd=0,
            padx=18,
            pady=10,
            font=("Segoe UI", 10, "bold"),
        )
        b.bind(
            "<Enter>",
            lambda _e: b.config(bg=active) if b["state"] == "normal" else None,
        )
        b.bind(
            "<Leave>",
            lambda _e: b.config(bg=bg) if b["state"] == "normal" else None,
        )
        return b

    def card(self, parent):
        return tk.Frame(
            parent,
            bg=C["card"],
            highlightthickness=1,
            highlightbackground=C["border"],
        )

    def _shell(self):
        header = tk.Frame(self, bg=C["side"], height=62)
        header.pack(fill="x")
        header.pack_propagate(False)

        self.label(
            header,
            "ALAT PENGUJIAN KONEKSI DAN ANALISIS ECG",
            18,
            "bold",
        ).pack(side="left", padx=24)

        right = tk.Frame(header, bg=C["side"])
        right.pack(side="right", padx=24)

        tk.Label(
            right,
            text="●",
            bg=C["side"],
            fg=C["green"],
            font=("Segoe UI", 13),
        ).pack(side="left")
        self.label(
            right,
            "System Ready",
            10,
            "bold",
            C["muted"],
        ).pack(side="left", padx=6)

        body = tk.Frame(self, bg=C["bg"])
        body.pack(fill="both", expand=True)

        side = tk.Frame(body, bg=C["side"], width=215)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)

        self.label(
            side,
            "MAIN MENU",
            10,
            "bold",
            C["muted"],
        ).pack(anchor="w", padx=22, pady=(28, 12))

        self.nav = {}

        for key, text in (
            ("mqtt", "◉   Pengujian MQTT"),
            ("analysis", "▣   Data Analisis"),
            ("settings", "⚙   Pengaturan"),
        ):
            b = tk.Button(
                side,
                text=" " + text,
                anchor="w",
                command=lambda p=key: self.show(p),
                cursor="hand2",
                relief="flat",
                bd=0,
                bg=C["side"],
                fg=C["muted"],
                activebackground=C["card2"],
                activeforeground=C["text"],
                padx=20,
                pady=13,
                font=("Segoe UI", 10, "bold"),
            )
            b.pack(fill="x", padx=10, pady=2)
            self.nav[key] = b

        foot = tk.Frame(side, bg=C["side"])
        foot.pack(side="bottom", fill="x", padx=22, pady=24)
        self.label(foot, "Pengujian ECG", 10, "bold").pack(anchor="w")
        self.label(foot, "Tool v1.0", 9, fg=C["muted"]).pack(
            anchor="w",
            pady=2,
        )

        self.content = tk.Frame(body, bg=C["bg"])
        self.content.pack(side="left", fill="both", expand=True)
        self.pages = {}

    def page(self, key, title, subtitle):
        p = tk.Frame(self.content, bg=C["bg"])
        self.pages[key] = p

        header = tk.Frame(p, bg=C["bg"])
        header.pack(fill="x", padx=32, pady=(28, 18))
        self.label(header, title, 24, "bold").pack(anchor="w")
        self.label(header, subtitle, 11, fg=C["muted"]).pack(
            anchor="w",
            pady=(4, 0),
        )

        return p

    def show(self, name):
        for p in self.pages.values():
            p.pack_forget()

        self.pages[name].pack(fill="both", expand=True)

        for key, b in self.nav.items():
            b.config(
                bg=C["card2"] if key == name else C["side"],
                fg=C["blue"] if key == name else C["muted"],
            )

    def status(self, parent, text, color):
        f = tk.Frame(parent, bg=parent.cget("bg"))
        dot = tk.Label(
            f,
            text="●",
            bg=f.cget("bg"),
            fg=color,
            font=("Segoe UI", 12),
        )
        dot.pack(side="left")

        value = self.label(f, text, 9, "bold", C["muted"])
        value.pack(side="left", padx=5)

        return f, dot, value

    def set_status(self, status, text, color):
        status[1].config(fg=color)
        status[2].config(text=text)

    # MQTT TESTING
    def _mqtt_page(self):
        p = self.page(
            "mqtt",
            "Pengujian Komunikasi MQTT",
            "Monitor komunikasi realtime dari ECG device",
        )

        status = tk.Frame(p, bg=C["bg"])
        status.pack(fill="x", padx=32, pady=(0, 20))
        self.mqtt_status = self.status(status, "MQTT DISCONNECTED", C["red"])
        self.mqtt_status[0].pack(side="left", padx=(0, 24))
        self.ntp_status = self.status(status, "NTP NOT SYNCHRONIZED", C["yellow"])
        self.ntp_status[0].pack(side="left")

        metrics = tk.Frame(p, bg=C["bg"])
        metrics.pack(fill="x", padx=32)
        metrics.columnconfigure((0, 1, 2), weight=1, uniform="m")
        self.metrics = {}

        for i, (title, key) in enumerate(
            (
                ("Average Latency", "average"),
                ("Min Latency", "min"),
                ("Max Latency", "max"),
                ("Packets", "packets"),
                ("Packets Lost", "lost"),
                ("Packet Loss", "loss"),
            )
        ):
            c = self.card(metrics)
            c.grid(
                row=i // 3,
                column=i % 3,
                sticky="nsew",
                padx=6,
                pady=6,
                ipady=7,
            )
            tk.Label(
                c,
                text=title.upper(),
                bg=C["card"],
                fg=C["muted"],
                font=("Segoe UI", 9, "bold"),
            ).pack(anchor="w", padx=18, pady=(13, 5))
            v = tk.Label(
                c,
                text="--",
                bg=C["card"],
                fg=C["text"],
                font=("Segoe UI", 23, "bold"),
            )
            v.pack(anchor="w", padx=18, pady=(0, 12))
            self.metrics[key] = v

        details = self.card(p)
        details.pack(fill="x", padx=32, pady=(18, 10))
        self.detail = {}

        for i, (name, initial) in enumerate(
            (
                ("Device", "-"),
                ("Last Latency", "-"),
                ("Last Chunk", "-"),
                ("Test Duration", "00:00:00"),
            )
        ):
            details.columnconfigure(i, weight=1)
            cell = tk.Frame(details, bg=C["card"])
            cell.grid(row=0, column=i, sticky="ew", padx=16, pady=14)
            tk.Label(
                cell,
                text=name.upper(),
                bg=C["card"],
                fg=C["muted"],
                font=("Segoe UI", 8, "bold"),
            ).pack(anchor="w")
            v = tk.Label(
                cell,
                text=initial,
                bg=C["card"],
                fg=C["text"],
                font=("Segoe UI", 11, "bold"),
            )
            v.pack(anchor="w", pady=(5, 0))
            self.detail[name] = v

        actions = tk.Frame(p, bg=C["bg"])
        actions.pack(fill="x", padx=32, pady=(8, 24))
        self.start_b = self.button(actions, "▶  START TEST", self.start_test, True)
        self.start_b.pack(side="left", padx=(0, 10))
        self.stop_b = self.button(
            actions,
            "■  STOP TEST",
            self.stop_test,
            state="disabled",
        )
        self.stop_b.pack(side="left", padx=10)
        self.export_b = self.button(
            actions,
            "↓  EXPORT CSV",
            self.export_csv,
            state="disabled",
        )
        self.export_b.pack(side="left", padx=10)

        table_card = self.card(p)
        table_card.pack(fill="both", expand=True, padx=32, pady=(0, 28))
        tk.Label(
            table_card,
            text="RECENT PACKETS",
            bg=C["card"],
            fg=C["muted"],
            font=("Segoe UI", 9, "bold"),
        ).pack(anchor="w", padx=16, pady=(13, 4))

        holder = tk.Frame(table_card, bg=C["card"])
        holder.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self.table = ttk.Treeview(
            holder,
            columns=("time", "device", "sequence", "latency"),
            show="headings",
            style="Dark.Treeview",
            height=5,
        )

        for key, title, width in (
            ("time", "Time", 150),
            ("device", "Device", 180),
            ("sequence", "Chunk", 100),
            ("latency", "Latency", 120),
        ):
            self.table.heading(key, text=title)
            self.table.column(key, width=width, anchor="w")

        scroll = ttk.Scrollbar(
            holder,
            orient="vertical",
            command=self.table.yview,
        )
        self.table.config(yscrollcommand=scroll.set)
        self.table.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

    def start_test(self):
        if mqtt is None:
            messagebox.showerror(
                "MQTT unavailable",
                "Install paho-mqtt to use MQTT testing.",
            )
            return

        self.testing = True
        self.started = time.time()

        with self.lock:
            self.packets.clear()
            self.all_packets.clear()

        self._reset_mqtt()
        self.start_b.config(state="disabled")
        self.stop_b.config(state="normal")
        self.set_status(self.mqtt_status, "MQTT CONNECTING", C["yellow"])
        threading.Thread(target=self._connect, daemon=True).start()

    def stop_test(self):
        self.testing = False

        if self.client:
            try:
                self.client.disconnect()
                self.client.loop_stop()
            except Exception:
                pass

        self.client = None
        self.start_b.config(state="normal")
        self.stop_b.config(state="disabled")
        self.export_b.config(state="normal" if self.all_packets else "disabled")
        self.set_status(self.mqtt_status, "MQTT DISCONNECTED", C["red"])

    def _connect(self):
        self._sync_ntp()

        if not self.testing:
            return

        if not all([BROKER, PORT, MQTT_PATH, TOPIC, USERNAME, PASSWORD]):
            self._connection_error(
                "Konfigurasi MQTT belum lengkap. Periksa file .env lokal."
            )
            return

        try:
            try:
                c = mqtt.Client(
                    mqtt.CallbackAPIVersion.VERSION2,
                    transport="websockets",
                )
            except (AttributeError, TypeError):
                c = mqtt.Client(transport="websockets")

            self.client = c

            c.username_pw_set(USERNAME, PASSWORD)
            c.ws_set_options(path=MQTT_PATH)
            c.tls_set()

            c.on_connect = self._on_connect
            c.on_disconnect = self._on_disconnect
            c.on_message = self._on_message

            c.connect(BROKER, PORT, 60)
            c.loop_start()

        except Exception as e:
            error_message = str(e)
            self.after(
                0,
                lambda: self._connection_error(error_message)
            )

    def _sync_ntp(self):
        ok = False

        if ntplib:
            try:
                r = ntplib.NTPClient().request(
                    "pool.ntp.org",
                    version=3,
                    timeout=5,
                )
                self.ntp_offset = r.tx_time - time.time()
                ok = True
            except Exception:
                pass

        self.after(
            0,
            lambda: self.set_status(
                self.ntp_status,
                "NTP SYNCHRONIZED" if ok else "NTP UNAVAILABLE",
                C["green"] if ok else C["yellow"],
            ),
        )

    def _on_connect(self, client, _u, _f, reason, _p=None):
        if reason == 0:
            client.subscribe(TOPIC)
            self.after(
                0,
                lambda: self.set_status(
                    self.mqtt_status,
                    "MQTT CONNECTED",
                    C["green"],
                ),
            )
        else:
            self.after(
                0,
                lambda: self._connection_error(
                    f"Broker refused connection ({reason})"
                ),
            )

    def _on_disconnect(self, *_):
        if self.testing:
            self.after(
                0,
                lambda: self.set_status(
                    self.mqtt_status,
                    "MQTT DISCONNECTED",
                    C["red"],
                ),
            )

    def _on_message(self, _c, _u, msg):
        try:
            data = json.loads(msg.payload.decode("utf-8"))
            latency = int((time.time() + self.ntp_offset) * 1000) - int(
                data["startMillis"]
            )
            item = {
                "time": time.strftime("%H:%M:%S"),
                "latency": latency,
                "device": str(data.get("deviceId", "-")),
                "sequence": data.get("chunkSeq", "-"),
            }

            with self.lock:
                self.packets.append(item)
                self.all_packets.append(item)

            self.after(0, self._update_mqtt)
        except (ValueError, KeyError, UnicodeDecodeError, json.JSONDecodeError):
            pass

    def _connection_error(self, text):
        self.testing = False
        self.start_b.config(state="normal")
        self.stop_b.config(state="disabled")
        self.set_status(self.mqtt_status, "MQTT CONNECTION ERROR", C["red"])
        messagebox.showerror(
            "MQTT connection error",
            f"Unable to connect to the MQTT broker.\n\n{text}",
        )

    def _reset_mqtt(self):
        for k, v in self.metrics.items():
            v.config(text="0" if k in ("packets", "lost") else "--")

        for k, v in self.detail.items():
            v.config(text="00:00:00" if k == "Test Duration" else "-")

        self.table.delete(*self.table.get_children())
        self.export_b.config(state="disabled")

    @staticmethod
    def _lost(data):
        nums = []

        for row in data:
            try:
                nums.append(int(row["sequence"]))
            except (ValueError, TypeError):
                pass

        return sum(max(0, b - a - 1) for a, b in zip(nums, nums[1:]) if b > a)

    def _update_mqtt(self):
        with self.lock:
            visible = list(self.packets)
            all_data = list(self.all_packets)

        if not visible:
            return

        values = [x["latency"] for x in all_data]
        lost = self._lost(all_data)
        total = len(all_data) + lost

        for k, v in {
            "average": f"{sum(values) / len(values):.1f} ms",
            "min": f"{min(values):.1f} ms",
            "max": f"{max(values):.1f} ms",
            "packets": f"{len(all_data):,}",
            "lost": f"{lost:,}",
            "loss": f"{lost / total * 100 if total else 0:.2f} %",
        }.items():
            self.metrics[k].config(text=v)

        x = visible[-1]
        self.detail["Device"].config(text=x["device"])
        self.detail["Last Latency"].config(text=f"{x['latency']:.1f} ms")
        self.detail["Last Chunk"].config(text=str(x["sequence"]))

        self.table.delete(*self.table.get_children())

        for x in reversed(visible):
            self.table.insert(
                "",
                "end",
                values=(
                    x["time"],
                    x["device"],
                    x["sequence"],
                    f"{x['latency']:.1f} ms",
                ),
            )

        self.export_b.config(state="normal")

    def _tick(self):
        if self.testing and self.started:
            self.detail["Test Duration"].config(
                text=time.strftime(
                    "%H:%M:%S",
                    time.gmtime(int(time.time() - self.started)),
                )
            )

        self.after(500, self._tick)

    def export_csv(self):
        path = filedialog.asksaveasfilename(
            title="Export MQTT results",
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")],
            initialfile="mqtt_latency_results.csv",
        )

        if not path:
            return

        try:
            with open(path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(
                    f,
                    fieldnames=("time", "device", "sequence", "latency"),
                )
                w.writeheader()
                w.writerows(self.all_packets)
        except OSError as e:
            messagebox.showerror(
                "Export failed",
                f"Unable to save the CSV file.\n\n{e}",
            )

    # DATA ANALisisi
    def _analysis_page(self):
        p = self.page(
            "analysis",
            "Analisis Data ECG",
            "Analisis Data ECG dari CSV atau EXCEL",
        )

        c = self.card(p)
        c.pack(fill="x", padx=32, pady=(0, 16))
        self.label(c, "Import ECG Data", 16, "bold").pack(pady=(22, 3))
        self.label(
            c,
            "CSV atau Excel (.csv, .xlsx, .xls)",
            10,
            fg=C["muted"],
        ).pack(pady=(0, 15))
        self.button(c, "+  IMPORT FILE", self.import_file, True).pack(pady=(0, 22))

        info = tk.Frame(p, bg=C["bg"])
        info.pack(fill="x", padx=32, pady=(0, 12))
        self.file_name = self.label(
            info,
            "No file loaded",
            10,
            "bold",
            C["muted"],
        )
        self.file_name.pack(side="left")
        self.file_shape = self.label(info, "", 10, fg=C["muted"])
        self.file_shape.pack(side="right")

        controls = tk.Frame(p, bg=C["bg"])
        controls.pack(fill="x", padx=32, pady=(0, 12))
        self.label(
            controls,
            "SELECT CHANNEL",
            9,
            "bold",
            C["muted"],
        ).pack(side="left", padx=(0, 10))
        self.channel = tk.StringVar()
        self.combo = ttk.Combobox(
            controls,
            textvariable=self.channel,
            state="disabled",
            width=24,
            style="Dark.TCombobox",
        )
        self.combo.pack(side="left")
        self.graph_b = self.button(
            controls,
            "SHOW GRAPH",
            self.show_graph,
            True,
            "disabled",
        )
        self.graph_b.pack(side="left", padx=12)

        gc = self.card(p)
        gc.pack(fill="both", expand=True, padx=32, pady=(0, 14))
        self.graph_heading = tk.Label(
            gc,
            text="ECG WAVEFORM",
            bg=C["card"],
            fg=C["muted"],
            font=("Segoe UI", 9, "bold"),
        )
        self.graph_heading.pack(anchor="w", padx=16, pady=(13, 0))

        self.fig = Figure(facecolor=C["card"], dpi=100)
        self.ax = self.fig.add_subplot(111)
        self.ax.set_facecolor(C["card"])

        self.ax.tick_params(colors=C["muted"])
        for spine in self.ax.spines.values():
            spine.set_color(C["border"])

        self.ax.grid(
            True,
            color=C["border"],
            linewidth=0.6,
            alpha=0.8,
        )

        # Buat canvas terlebih dahulu sebelum dikonfigurasi
        self.canvas = FigureCanvasTkAgg(
            self.fig,
            master=gc,
        )
        self.canvas.get_tk_widget().configure(
            bg=C["card"],
            highlightthickness=0,
        )
        self.canvas.get_tk_widget().pack(
            fill="both",
            expand=True,
            padx=12,
            pady=8,
        )

        # Buat toolbar setelah canvas tersedia
        self.toolbar = NavigationToolbar2Tk(
            self.canvas,
            gc,
            pack_toolbar=False,
        )
        self.toolbar.update()
        self.toolbar.configure(background=C["card"])
        self.toolbar.pack(side="bottom", anchor="w")


        stats = tk.Frame(p, bg=C["bg"])
        stats.pack(fill="x", padx=32, pady=(0, 28))
        stats.columnconfigure((0, 1, 2, 3, 4, 5), weight=1, uniform="s")
        self.stats = {}

        for i, n in enumerate(
            ("Samples", "Duration", "Sampling Rate", "Minimum", "Maximum", "Mean")
        ):
            q = self.card(stats)
            q.grid(row=0, column=i, sticky="nsew", padx=4, ipady=5)
            tk.Label(
                q,
                text=n.upper(),
                bg=C["card"],
                fg=C["muted"],
                font=("Segoe UI", 8, "bold"),
            ).pack(anchor="w", padx=11, pady=(9, 2))
            v = tk.Label(
                q,
                text="N/A",
                bg=C["card"],
                fg=C["text"],
                font=("Segoe UI", 12, "bold"),
            )
            v.pack(anchor="w", padx=11, pady=(0, 9))
            self.stats[n] = v

    def _axis(self, title):
        self.ax.clear()
        self.ax.set_facecolor(C["card"])
        self.ax.set_title(
            title,
            color=C["text"],
            fontsize=11,
            loc="left",
            pad=12,
        )
        self.ax.tick_params(colors=C["muted"], labelsize=8)

        for s in self.ax.spines.values():
            s.set_color(C["border"])

        self.ax.grid(True, color=C["border"], linewidth=0.7, alpha=0.75)

    def import_file(self):
        path = filedialog.askopenfilename(
            title="Import ECG data",
            filetypes=[
                ("ECG data", "*.csv *.xlsx *.xls"),
                ("CSV files", "*.csv"),
                ("Excel files", "*.xlsx *.xls"),
                ("All files", "*.*"),
            ],
        )

        if not path:
            return

        if pd is None:
            messagebox.showerror(
                "Unable to read file",
                "Data import requires the pandas package.",
            )
            return

        try:
            source = Path(path)

            if source.suffix.lower() == ".csv":
                data = pd.read_csv(source)
            elif source.suffix.lower() == ".xlsx":
                try:
                    data = pd.read_excel(source)
                except ImportError:
                    data = read_simple_xlsx(source)
            elif source.suffix.lower() == ".xls":
                data = pd.read_excel(source)
            else:
                data = None

            if data is None or data.empty:
                raise ValueError("The selected file has no data rows.")

            numeric = [
                x
                for x in data.select_dtypes(include="number").columns
                if str(x).lower() not in ("timestamp", "time", "datetime")
            ]

            if not numeric:
                raise ValueError(
                    "The selected file does not contain numeric ECG channels."
                )
        except Exception as e:
            messagebox.showerror(
                "Unable to read file",
                "The selected file does not contain valid ECG data.\n\n" f"{e}",
            )
            return

        self.data = data
        names = [self._channel_name(x) for x in numeric]
        self.channel_map = dict(zip(names, numeric))
        self.combo.config(values=names, state="readonly")
        self.channel.set(names[0])
        self.graph_b.config(state="normal")
        self.file_name.config(text=f"File:  {source.name}", fg=C["text"])
        self.file_shape.config(
            text=f"Rows:  {len(data):,}     Columns:  {len(data.columns)}"
        )
        self.show_graph()

    @staticmethod
    def _channel_name(col):
        x = str(col).lower().replace("_", "").replace(" ", "")
        return {
            "lead1": "Lead I",
            "leadi": "Lead I",
            "lead2": "Lead II",
            "leadii": "Lead II",
            "lead3": "Lead III",
            "leadiii": "Lead III",
        }.get(x, str(col))

    def show_graph(self):
        if self.data is None:
            return

        series = self.data[self.channel_map[self.channel.get()]].dropna()

        if series.empty:
            messagebox.showerror(
                "Unable to plot data",
                "The selected channel contains no numeric samples.",
            )
            return

        self._axis(self.channel.get())
        step = max(1, len(series) // 7000)
        draw = series.iloc[::step]
        self.ax.plot(draw.index,draw.values,color="#72784B",linewidth=1.0,)
        self.ax.set_xlabel("Sample", color=C["muted"], fontsize=8)
        self.ax.set_ylabel("Amplitude", color=C["muted"], fontsize=8)
        self.fig.tight_layout(pad=1.4)
        self.canvas.draw_idle()
        self.graph_heading.config(
            text=f"{self.channel.get().upper()}  •  ECG WAVEFORM"
        )
        self._stats(series)

    def _stats(self, s):
        duration, rate = self._timing()
        vals = {
            "Samples": f"{len(s):,}",
            "Duration": duration,
            "Sampling Rate": rate,
            "Minimum": f"{s.min():.3f}",
            "Maximum": f"{s.max():.3f}",
            "Mean": f"{s.mean():.3f}",
        }

        for k, v in vals.items():
            self.stats[k].config(text=v)

    def _timing(self):
        col = next(
            (
                x
                for x in self.data.columns
                if str(x).lower() in ("timestamp", "time", "datetime")
            ),
            None,
        )

        if col is None:
            return "N/A", "N/A"

        try:
            v = pd.to_numeric(self.data[col], errors="coerce").dropna()

            if len(v) < 2:
                return "N/A", "N/A"

            dt = float(v.diff().dropna().median())
            unit = 0.001 if abs(dt) > 1 else 1
            return (
                f"{(float(v.iloc[-1]) - float(v.iloc[0])) * unit:.2f} s",
                f"{1 / (dt * unit):.0f} Hz" if dt else "N/A",
            )
        except Exception:
            return "N/A", "N/A"

    def _settings_page(self):
        p = self.page(
            "settings",
            "Pengaturan",
            "Pengaturan koneksi untuk MQTT",
        )
        c = self.card(p)
        c.pack(fill="x", padx=32, pady=(0, 16))
        self.label(c, "MQTT Broker", 11, "bold", C["muted"]).pack(
            anchor="w",
            padx=20,
            pady=(20, 4),
        )
        self.label(c, f"{BROKER}:{PORT}", 12).pack(
            anchor="w",
            padx=20,
            pady=(0, 20),
        )
        self.label(
            p,
            "Broker credentials are configured in PENGUJIAN.py.",
            10,
            fg=C["muted"],
        ).pack(anchor="w", padx=32)

    def close(self):
        self.stop_test()
        self.destroy()


if __name__ == "__main__":
    ECGTestingTool().mainloop()
