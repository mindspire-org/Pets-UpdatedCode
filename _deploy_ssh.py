import sys, paramiko, time
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HOST = "2.24.130.149"
USER = "root"
PASS = "Qutaibah5544@"

def run(cmd, timeout=900):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=30, look_for_keys=False, allow_agent=False)
    chan = client.get_transport().open_session()
    chan.settimeout(timeout)
    chan.get_pty()
    chan.exec_command(cmd)
    out = b""
    while True:
        if chan.recv_ready():
            data = chan.recv(65536)
            out += data
            sys.stdout.write(data.decode("utf-8", "replace"))
            sys.stdout.flush()
        if chan.exit_status_ready() and not chan.recv_ready():
            break
        time.sleep(0.05)
    while chan.recv_ready():
        data = chan.recv(65536)
        out += data
        sys.stdout.write(data.decode("utf-8", "replace"))
    code = chan.recv_exit_status()
    client.close()
    return code

if __name__ == "__main__":
    if "--stdin" in sys.argv:
        cmd = sys.stdin.read()
    else:
        cmd = " ".join(sys.argv[1:])
    rc = run(cmd)
    sys.stderr.write("\n[exit code: %d]\n" % rc)
    sys.exit(rc)
