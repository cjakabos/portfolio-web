"""Runtime configuration tests for the ML pipeline service."""

import app as app_module


class TestRuntimeConfiguration:
    """Tests for ML pipeline local-dev startup defaults and overrides."""

    def test_debug_is_disabled_by_default(self, monkeypatch):
        monkeypatch.delenv("FLASK_DEBUG", raising=False)

        assert app_module.is_debug_enabled() is False

    def test_debug_can_be_enabled_explicitly(self, monkeypatch):
        monkeypatch.setenv("FLASK_DEBUG", "true")

        assert app_module.is_debug_enabled() is True

    def test_runtime_port_prefers_explicit_port(self, monkeypatch):
        monkeypatch.setenv("PORT", "9100")
        monkeypatch.setenv("LISTEN_PORT", "8600")

        assert app_module.get_runtime_port() == 9100

    def test_invalid_runtime_port_falls_back_to_default(self, monkeypatch, caplog):
        monkeypatch.setenv("PORT", "not-a-port")
        monkeypatch.delenv("LISTEN_PORT", raising=False)

        assert app_module.get_runtime_port() == 8600
        assert "defaulting to 8600" in caplog.text

    def test_run_dev_server_uses_resolved_runtime_settings(self, monkeypatch):
        calls = []

        def fake_run(**kwargs):
            calls.append(kwargs)

        monkeypatch.setenv("HOST", "127.0.0.1")
        monkeypatch.setenv("PORT", "9999")
        monkeypatch.setenv("FLASK_DEBUG", "1")
        monkeypatch.setattr(app_module.app, "run", fake_run)

        app_module.run_dev_server()

        assert calls == [{
            "host": "127.0.0.1",
            "port": 9999,
            "debug": True,
            "threaded": True,
        }]
