FROM debian:bullseye-slim AS ngx_http_auth_jwt_builder_base
LABEL stage=ngx_http_auth_jwt_builder
RUN set -eux; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends curl build-essential; \
    rm -rf /var/lib/apt/lists/*


FROM ngx_http_auth_jwt_builder_base AS ngx_http_auth_jwt_builder_module
LABEL stage=ngx_http_auth_jwt_builder
ENV PATH "${PATH}:/etc/nginx"
ENV LD_LIBRARY_PATH=/usr/local/lib
ENV NGINX_VERSION 1.25.4
RUN set -eux; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends \
      libpcre2-dev zlib1g-dev libpcre3-dev libssl-dev curl; \
    rm -rf /var/lib/apt/lists/*
WORKDIR /root/build
RUN <<`
	set -e
	mkdir nginx
	curl -O http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz
	tar -xzf nginx-${NGINX_VERSION}.tar.gz --strip-components 1 -C nginx
`
WORKDIR /root/build/nginx
# FIX 4.2: Build with --user=nginx instead of --user=root
# FIX 4.3: Added --with-http_ssl_module for TLS termination
RUN <<`
	set -e
	BUILD_FLAGS=''
	MAJ=$(echo ${NGINX_VERSION} | cut -f1 -d.)
	MIN=$(echo ${NGINX_VERSION} | cut -f2 -d.)
	REV=$(echo ${NGINX_VERSION} | cut -f3 -d.)

	BUILD_FLAGS="${BUILD_FLAGS} --with-cc-opt='-DNGX_LINKED_LIST_COOKIES=1'"

	./configure \
    --prefix=/etc/nginx \
		--sbin-path=/usr/sbin/nginx \
		--modules-path=/usr/lib64/nginx/modules \
		--conf-path=/etc/nginx/nginx.conf \
		--error-log-path=/var/log/nginx/error.log \
		--http-log-path=/var/log/nginx/access.log \
		--pid-path=/tmp/nginx.pid \
		--lock-path=/tmp/nginx.lock \
		--http-client-body-temp-path=/tmp/client_body \
		--http-proxy-temp-path=/tmp/proxy \
		--http-fastcgi-temp-path=/tmp/fastcgi \
		--http-uwsgi-temp-path=/tmp/uwsgi \
		--http-scgi-temp-path=/tmp/scgi \
		--user=nginx \
		--with-compat \
		--with-debug \
		--with-file-aio \
		--with-threads \
		--with-http_addition_module \
		--with-http_auth_request_module \
		--with-http_dav_module \
		--with-http_flv_module \
		--with-http_gunzip_module \
		--with-http_gzip_static_module \
		--with-http_mp4_module \
		--with-http_random_index_module \
		--with-http_realip_module \
		--with-http_secure_link_module \
		--with-http_slice_module \
		--with-http_ssl_module \
			--with-http_stub_status_module \
			--with-http_sub_module \
			--with-http_v2_module \
			--with-cc-opt='-g -O2 -ffile-prefix-map=/data/builder/debuild/nginx-1.25.4/debian/debuild-base/nginx-1.25.4=. -fstack-protector-strong -Wformat -Werror=format-security -Wp,-D_FORTIFY_SOURCE=2 -fPIC' \
			--with-ld-opt='-Wl,-z,relro -Wl,-z,now -Wl,--as-needed -pie' \
			${BUILD_FLAGS}
`
RUN make modules
RUN make install
RUN rm -rf /root/build
RUN mkdir -p /var/cache/nginx /var/log/nginx
WORKDIR /etc/nginx

FROM ngx_http_auth_jwt_builder_module AS ngx_http_auth_jwt_nginx
LABEL maintainer="TeslaGov" email="developers@teslagov.com"
ENV NGINX_VERSION 1.25.5
RUN set -eux; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends libssl1.1 gettext-base wget; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# FIX 4.2: Create dedicated nginx user and group
RUN groupadd -r nginx && useradd -r -g nginx -d /var/cache/nginx -s /sbin/nologin nginx

# Copy configuration files
COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY conf/locations.conf /etc/nginx/locations.conf.template
COPY localhost+3-key.pub /etc/nginx/localhost+3-key.pub

# FIX 4.3: Copy TLS certificates for HTTPS
RUN mkdir -p /etc/nginx/ssl
COPY localhost+3.pem /etc/nginx/ssl/localhost+3.pem
COPY localhost+3-key.pem /etc/nginx/ssl/localhost+3-key.pem

# FIX 4.2: Set ownership for non-root operation
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/ssl /tmp \
    && chmod 600 /etc/nginx/ssl/localhost+3-key.pem

CMD ["/bin/sh", "-c", "envsubst '${INTERNAL_SERVICE_TOKEN}' < /etc/nginx/locations.conf.template > /etc/nginx/locations.conf && exec nginx -g 'daemon off;'"]

EXPOSE 80 443
