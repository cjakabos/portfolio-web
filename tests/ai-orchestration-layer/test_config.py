from core.config import ServiceConfiguration


def test_service_configuration_reads_internal_service_token_from_env(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "token-from-env")

    config = ServiceConfiguration.from_env()

    assert config.internal_service_token == "token-from-env"


def test_service_configuration_defaults_internal_service_token_to_empty(monkeypatch):
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)

    config = ServiceConfiguration.from_env()

    assert config.internal_service_token == ""
