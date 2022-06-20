const Gettext = imports.gettext;
const Main = imports.ui.main;
const GObject = imports.gi.GObject;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { St, GLib, Clutter, Gio, Shell } = imports.gi;
const MainLoop = imports.mainloop

const Config = imports.misc.config;
const Lang = imports.lang;
const Util = imports.misc.util;

const Mainloop = imports.mainloop;

const Domain = Gettext.domain(Me.metadata.uuid);
const _ = Domain.gettext;
const aggregateMenu = Main.panel.statusArea.aggregateMenu;

const systemMenu = aggregateMenu._system.menu;
const powerIndicator = _getIndicators(aggregateMenu._power);
const powerMenu = aggregateMenu._power.menu.firstMenuItem.menu;

function get_battery_state() {
	var [ok, out, err, exit] = GLib.spawn_command_line_sync('cat /sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/conservation_mode');
	if (out.length > 0) {
		state = out.toString().trim('\n')
		if (state == '0')
			return 0
		else if (state == '1')
			return 1
	} else
		return -1
}

function get_mode_state($string) {
	var [ok, out, err, exit] = GLib.spawn_command_line_sync('cat /sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/' + $string);
	if (out.length > 0) {
		state = out.toString().trim('\n')
		if (state == '0')
			return 0
		else if (state == '1' || state == '133')
			return 1
	} else
		return -1
}



function set_mode_on($string) {
	let cmd = 'pkexec  bash -c "echo 1  > /sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/' + $string + '\n"'
	GLib.spawn_command_line_async(cmd);
}

function set_mode_off($string) {
	let cmd = 'pkexec  bash -c "echo 0 > /sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/' + $string + '\n"'
	GLib.spawn_command_line_async(cmd);
}

function set_conservative_mode_toggle($status) {
	let cmd = 'pkexec  bash -c "echo ' + $status + '  > /sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/conservation_mode\n"'
	GLib.spawn_command_line_async(cmd);
}


function _getIndicators(delegate) {
	if (delegate instanceof St.BoxLayout) {
		return delegate;
	}

	return delegate.indicators;
}

function _auto_dev_discovery(search_path) {
	let mod_path = Gio.file_new_for_path(search_path);

	let walker = mod_path.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);

	let child = null;
	let found = null;
	while ((child = walker.next_file(null))) {
		if (child.get_is_symlink() && child.get_name().startsWith("VPC2004")) {
			// ideapad_device_ids[] from the kernel module ideapad_acpi.c
			found = _auto_dev_discovery(`${search_path}/${child.get_name()}`);
		} else if (child.get_name() == "conservation_mode") {
			log(`IdeaPad device FOUND at ${search_path}`);
			found = `${search_path}/${child.get_name()}`;
		}
		// Stop as soon as the device is found.
		if (found !== null) break;
	}

	return found;
}



let sys_conservation = null;
const BatteryConservationIndicator = GObject.registerClass(
	class BatteryConservationIndicator extends PanelMenu.SystemIndicator {
		_init() {
			super._init();

			this._indicator = this._addIndicator();
			this._indicator.icon_name = "emoji-nature-symbolic";
			powerIndicator.add_child(_getIndicators(this));

			// Monitor the changes and show or hide the indicator accordingly.
			const fileM = Gio.file_new_for_path(sys_conservation);
			this._monitor = fileM.monitor(Gio.FileMonitorFlags.NONE, null);
			this._monitor.connect('changed', Lang.bind(this, this._syncStatus));


			this.item = new PopupMenu.PopupSubMenuMenuItem('Legion mode', true);
			this.item.icon.icon_name = "emoji-activities-symbolic";


			if (get_mode_state('conservation_mode') >= 0) {
				this._widget = new PopupMenu.PopupSwitchMenuItem(_("Conservation Mode"), get_battery_state());
				this._widget.connect("toggled", Lang.bind(this, function (item) {
					if (item.state) {
						set_mode_on('conservation_mode');
					} else {
						set_mode_off('conservation_mode');
					}
				}));
				this.item.menu.addMenuItem(this._widget, 0);
			}
			// powerMenu.addMenuItem(this._widget, 0);


			if (get_mode_state('fn_lock') >= 0) {
				this._widget1 = new PopupMenu.PopupSwitchMenuItem(_("Fn Lock"), get_mode_state('fn_lock'));
				this._widget1.connect("toggled", Lang.bind(this, function (item) {
					if (item.state) {
						set_mode_on('fn_lock');
					} else {
						set_mode_off('fn_lock');
					}
				}));
				this.item.menu.addMenuItem(this._widget1, 1);
			}

			if (get_mode_state('camera_power') >= 0) {
				//Control the power of camera module. 1 means on, 0 means off.
				this._camera_power = new PopupMenu.PopupSwitchMenuItem(_("Camera Power"), get_mode_state('camera_power'));
				this._camera_power.connect("toggled", Lang.bind(this, function (item) {
					if (item.state) {
						set_mode_on('camera_power');
					} else {
						set_mode_off('camera_power');
					}
				}));
				this.item.menu.addMenuItem(this._camera_power, 3);
			}

			if (get_mode_state('usb_charging') >= 0) {
				//Controls whether the "always on USB charging" feature is enabled or not. This feature enables charging USB devices even if the computer is not turned on.
				this._usb_charging = new PopupMenu.PopupSwitchMenuItem(_("USB Charging"), get_mode_state('usb_charging'));
				this._usb_charging.connect("toggled", Lang.bind(this, function (item) {
					if (item.state) {
						set_mode_on('usb_charging');
					} else {
						set_mode_off('usb_charging');
					}
				}));
				this.item.menu.addMenuItem(this._usb_charging, 4);
			}

			if (get_mode_state('touchpad') >= 0) {
				this._touchpad = new PopupMenu.PopupSwitchMenuItem(_("Touchpad"), get_mode_state('touchpad'));
				this._touchpad.connect("toggled", Lang.bind(this, function (item) {
					if (item.state) {
						set_mode_on('touchpad');
					} else {
						set_mode_off('touchpad');
					}
				}));
				this.item.menu.addMenuItem(this._touchpad, 5);
			}





			// item.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);

			systemMenu.addMenuItem(this.item, 0);

			this._syncStatus();
		}

		_syncStatus() {
			let status = get_battery_state();
			if (status == null) {
				log('the Battery state is null so the lenovo Battery conservation mode has failed state is null = ' + get_battery_state())
				return true
			}
			//log('state now = '+state)
			if (status == 1) {
				this._widget.setToggleState(true);
			}
			if (status == 0) {
				this._widget.setToggleState(false);
			}
			if (status == -1) {
				this._widget.label.text = _(`Conservation Mode ERR`);
				this._widget.visible = 0;
			}

			const active = (status == "1");
			this._indicator.visible = active;
		}

		static _toggleConservationMode() {
			let status = get_battery_state();
			const new_status = (status == "1") ? "0" : "1";
			set_conservative_mode_toggle(new_status)
		}

		destroy() {
			this._indicator.destroy();
			this._monitor.cancel();
			this._camera_power.destroy();
			this._usb_charging.destroy();
			this._touchpad.destroy();
			this._widget1.destroy();
			this._widget.destroy();
			this.item.destroy();
		}
	}
);


function init() {


	ExtensionUtils.initTranslations(Me.metadata.uuid);

}


let batteryConservationIndicator = null;

function enable() {
	let sysfs_path = "/sys/bus/platform/drivers/ideapad_acpi";

	if (sys_conservation === null) {
		sys_conservation = _auto_dev_discovery(sysfs_path);

		if (sys_conservation === null) {
			throw new Error(_("Battery conservation mode not available."));
		}
	}

	if (batteryConservationIndicator == null) {
		batteryConservationIndicator = new BatteryConservationIndicator();
	}
}

function disable() {
	batteryConservationIndicator.destroy();
	batteryConservationIndicator = null;
}
