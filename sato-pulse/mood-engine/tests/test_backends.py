import pytest

from mood_engine.backends import create_backend


@pytest.mark.parametrize("name", ["deepface_mobilenet", "deepface_opencv"])
def test_local_backends_are_supported(name):
    backend = create_backend(name)
    assert backend is not None


@pytest.mark.parametrize("name", ["cloud_aws", "cloud_google"])
def test_cloud_backends_are_rejected(name):
    with pytest.raises(ValueError):
        create_backend(name)
