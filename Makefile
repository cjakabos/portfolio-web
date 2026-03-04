-include .env
export

.PHONY: mobile-add-ios test-mobile-smoke test-ios-smoke test-ios-smoke-xcode test-ios-smoke-simulator test-ios-smoke-all

mobile-add-ios:
	cd frontend/cloudapp-shell && if npm ls @capacitor/ios >/dev/null 2>&1; then \
		echo "@capacitor/ios already installed."; \
	else \
		npm install @capacitor/ios; \
	fi && if [ -d ios ]; then \
		echo "iOS platform already exists; running cap sync ios instead."; \
		npx cap sync ios; \
	else \
		npx cap add ios; \
	fi

test-mobile-smoke:
	./scripts/test-mobile-smoke.sh

test-ios-smoke:
	./scripts/test-ios-smoke.sh

test-ios-smoke-xcode:
	IOS_SMOKE_MODE=xcode ./scripts/test-ios-smoke.sh

test-ios-smoke-simulator:
	IOS_SMOKE_MODE=simulator ./scripts/test-ios-smoke.sh

test-ios-smoke-all:
	IOS_SMOKE_MODE=all ./scripts/test-ios-smoke.sh
