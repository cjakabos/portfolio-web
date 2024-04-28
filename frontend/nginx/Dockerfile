FROM debian:bullseye-slim as ngx_http_auth_jwt_builder_base
LABEL stage=ngx_http_auth_jwt_builder
RUN <<`
apt-get update
apt-get install -y curl build-essential
`


FROM ngx_http_auth_jwt_builder_base as ngx_http_auth_jwt_builder_module
LABEL stage=ngx_http_auth_jwt_builder
ENV PATH "${PATH}:/etc/nginx"
ENV LD_LIBRARY_PATH=/usr/local/lib
ENV NGINX_VERSION 1.25.4
RUN <<`
	set -e
	apt-get install -y libjwt-dev libjwt0 libjansson-dev libjansson4 libpcre2-dev zlib1g-dev libpcre3-dev
	mkdir -p /root/build/ngx-http-auth-jwt-module
`
WORKDIR /root/build/ngx-http-auth-jwt-module
ADD config ./
ADD src/*.h src/*.c ./src/
WORKDIR /root/build
RUN <<`
	set -e
	mkdir nginx
	curl -O http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz
	tar -xzf nginx-${NGINX_VERSION}.tar.gz --strip-components 1 -C nginx
`
WORKDIR /root/build/nginx
RUN <<`
	set -e
	BUILD_FLAGS=''
	MAJ=$(echo ${NGINX_VERSION} | cut -f1 -d.)
	MIN=$(echo ${NGINX_VERSION} | cut -f2 -d.)
	REV=$(echo ${NGINX_VERSION} | cut -f3 -d.)

	# NGINX 1.23.0+ changes cookies to use a linked list, and renames `cookies` to `cookie`
	BUILD_FLAGS="${BUILD_FLAGS} --with-cc-opt='-DNGX_LINKED_LIST_COOKIES=1'"

	./configure \
    --prefix=/etc/nginx \
		--sbin-path=/usr/sbin/nginx \
		--modules-path=/usr/lib64/nginx/modules \
		--conf-path=/etc/nginx/nginx.conf \
		--error-log-path=/var/log/nginx/error.log \
		--http-log-path=/var/log/nginx/access.log \
		--pid-path=/var/run/nginx.pid \
		--lock-path=/var/run/nginx.lock \
		--http-client-body-temp-path=/var/cache/nginx/client_temp \
		--http-proxy-temp-path=/var/cache/nginx/proxy_temp \
		--http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp \
		--http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp \
		--http-scgi-temp-path=/var/cache/nginx/scgi_temp \
		--user=root \
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
		--with-http_stub_status_module \
		--with-http_sub_module \
		--with-http_v2_module \
		--with-cc-opt='-g -O2 -ffile-prefix-map=/data/builder/debuild/nginx-1.25.4/debian/debuild-base/nginx-1.25.4=. -fstack-protector-strong -Wformat -Werror=format-security -Wp,-D_FORTIFY_SOURCE=2 -fPIC' \
		--with-ld-opt='-Wl,-z,relro -Wl,-z,now -Wl,--as-needed -pie' \
		--add-dynamic-module=../ngx-http-auth-jwt-module \
		${BUILD_FLAGS}
		# --with-openssl=/usr/local \
`
RUN make modules
RUN make install
WORKDIR /usr/lib64/nginx/modules
RUN	cp /root/build/nginx/objs/ngx_http_auth_jwt_module.so .
RUN rm -rf /root/build
RUN mkdir -p /var/cache/nginx /var/log/nginx
WORKDIR /etc/nginx

FROM ngx_http_auth_jwt_builder_module AS ngx_http_auth_jwt_nginx
LABEL maintainer="TeslaGov" email="developers@teslagov.com"
ENV NGINX_VERSION 1.25.5
RUN <<`
	set -e

	apt-get update
	apt-get install -y libjansson4 libjwt0
	apt-get clean
`

COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY localhost+3-key.pub /etc/nginx/localhost+3-key.pub


CMD ["nginx", "-g", "daemon off;"]

EXPOSE 80
