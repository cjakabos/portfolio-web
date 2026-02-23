from core.config import ServiceConfiguration


def test_service_configuration_reads_internal_service_token_from_env(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "token-from-env")

    config = ServiceConfiguration.from_env()

    assert config.internal_service_token == "token-from-env"


def test_service_configuration_defaults_internal_service_token_to_empty(monkeypatch):
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)

    config = ServiceConfiguration.from_env()

    assert config.internal_service_token == ""


def test_service_configuration_uses_legacy_ml_pipeline_url_when_ml_url_missing(monkeypatch):
    monkeypatch.delenv("ML_URL", raising=False)
    monkeypatch.setenv("ML_PIPELINE_URL", "http://legacy-ml:8600/mlops-segmentation")

    config = ServiceConfiguration.from_env()

    assert config.ml_url == "http://legacy-ml:8600/mlops-segmentation"


def test_service_configuration_prefers_ml_url_over_legacy_alias(monkeypatch):
    monkeypatch.setenv("ML_URL", "http://primary-ml:8600/mlops-segmentation")
    monkeypatch.setenv("ML_PIPELINE_URL", "http://legacy-ml:8600/mlops-segmentation")

    config = ServiceConfiguration.from_env()

    assert config.ml_url == "http://primary-ml:8600/mlops-segmentation"
