all: build install

build:
	xgettext --from-code=UTF-8 --output=legion-mode\@prasanthk.com/locale/en.pot ./legion-mode\@prasanthk.com/*.js
	gnome-extensions pack -f --podir=locale ./legion-mode\@prasanthk.com/ --out-dir=./

install:
	gnome-extensions install --force ./legion-mode\@prasanthk.com.shell-extension.zip
