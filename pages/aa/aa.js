//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
    servicesFound: []
  },
  serviceId: null,
  foundDevice: [],
  getConnectedTimer: null,
  //事件处理函数
  bindViewTap: function () {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: function () {
    // this.getWeatherData();
  },
  //iOS 微信客户端 6.5.6 版本开始支持，Android 6.5.7 版本开始支持
  //初始化蓝牙适配器
  startConnect: function () {
    var that = this;
    wx.showLoading({
      title: '开启蓝牙适配'
    });
    wx.openBluetoothAdapter({
      success: function (res) {
        console.log("初始化蓝牙适配器");
        console.log(res);
        that.getBluetoothAdapterState();
      },
      fail: function (err) {
        console.log(err);
        wx.showToast({
          title: '蓝牙初始化失败，确保打开手机蓝牙',
          icon: 'none',
          duration: 2000
        })
        setTimeout(function () {
          wx.hideToast()
        }, 2000)
      }
    });
    //监听蓝牙适配器状态变化事件
    // wx.onBluetoothAdapterStateChange(function (res) {
    //   var available = res.available;
    //   if (available) {
    //     that.getBluetoothAdapterState();
    //   }
    // })
  },
  //检查蓝牙适配器状态
  getBluetoothAdapterState: function () {
    var that = this;
    wx.getBluetoothAdapterState({
      success: function (res) {
        var available = res.available, //蓝牙适配器是否可用
          discovering = res.discovering; //是否正在搜索设备
        if (!available) {
          wx.showToast({
            title: res.errMsg?res.errMsg:'设备无法开启蓝牙连接',
            icon: 'success',
            duration: 2000
          })
          setTimeout(function () {
            wx.hideToast()
          }, 2000)
        } else {
          if (!discovering) {
            that.startBluetoothDevicesDiscovery();
            that.getConnectedBluetoothDevices();
          }
        }
      }
    })
  },
  //开始搜寻附近的蓝牙外围设备
  startBluetoothDevicesDiscovery: function () {
    var that = this;
    wx.showLoading({
      title: '蓝牙搜索'
    });

    // 以微信硬件平台的蓝牙智能灯为例，主服务的 UUID 是 FEE7。传入这个参数，只搜索主服务 UUID 为 FEE7 的设备
    // services: ['FEE7'],
    wx.startBluetoothDevicesDiscovery({
      services: [], //蓝牙设备主 service 的 uuid 列表
      allowDuplicatesKey: false, //是否允许重复上报同一设备， 如果允许重复上报，则onDeviceFound 方法会多次上报同一设备，但是 RSSI 值会有不同
      interval: 0, //上报设备的间隔，默认为0
      success: function (res) {
        if (!res.isDiscovering) {
          that.getBluetoothAdapterState();
        } else {
          that.onBluetoothDeviceFound();
        }
      },
      fail: function (err) {
        console.log(err);
      }
    });
  },
  //停止搜寻附近的蓝牙外围设备
  stopBluetoothDevicesDiscovery: function() {
    wx.stopBluetoothDevicesDiscovery({
      success: function (res) {
        console.log(res)
      }
    })
  },
  //根据 uuid 获取处于已连接状态的设备
  getConnectedBluetoothDevices: function () {
    var that = this;
    wx.getConnectedBluetoothDevices({
      services: [that.serviceId],
      success: function (res) {
        console.log("获取处于连接状态的设备", res);
        var devices = res['devices'], flag = false, index = 0, conDevList = [];
        devices.forEach(function (value, index, array) {
          if (value['name'].indexOf('Feie Printer') != -1) {
            // 如果存在包含FeiZhi字段的设备
            flag = true;
            index += 1;
            conDevList.push(value['deviceId']);
            that.deviceId = value['deviceId'];
            return;
          }
        });
        if (flag) {
          this.connectDeviceIndex = 0;
          that.loopConnect(conDevList);
        } else {
          if (!this.getConnectedTimer) {
            that.getConnectedTimer = setTimeout(function () {
              that.getConnectedBluetoothDevices();
            }, 5000);
          }
        }
      },
      fail: function (err) {
        if (!this.getConnectedTimer) {
          that.getConnectedTimer = setTimeout(function () {
            that.getConnectedBluetoothDevices();
          }, 5000);
        }
      }
    });
  },
  ab2hex: function(buffer) {
    var hexArr = Array.prototype.map.call(
      new Uint8Array(buffer),
      function(bit) {
        return ('00' + bit.toString(16)).slice(-2)
      }
    )
    return hexArr.join('');
  },
  //监听寻找到新设备的事件
  onBluetoothDeviceFound: function () {
    var that = this;
    console.log('onBluetoothDeviceFound');
    wx.onBluetoothDeviceFound(function (res) {
      console.log('new device list has founded')
      console.log(res);
      if (res.devices[0]) {
        //
        let devices = res.devices[0]
        let servicesFound = that.data.servicesFound;
        servicesFound.push(devices);
        that.setData({
          servicesFound: servicesFound
        });
        //
        var name = res.devices[0]['name'];
        if (name != '') {
          if (name.indexOf('Feie Printer') != -1) {
            var deviceId = res.devices[0]['deviceId'];
            that.deviceId = deviceId; //获取目标事件deviceId
            console.log(that.deviceId);
            // that.startConnectDevices();
          }
        }
      }
    })
  },
  //开始配对该设备
  startConnectDevices: function (ltype, array) {
    var that = this;
    clearTimeout(that.getConnectedTimer);
    that.getConnectedTimer = null;
    clearTimeout(that.discoveryDevicesTimer);
    that.stopBluetoothDevicesDiscovery();
    this.isConnectting = true;
    //连接低功耗蓝牙设备
    wx.createBLEConnection({
      deviceId: that.deviceId,
      success: function (res) {
        if (res.errCode == 0) {
          setTimeout(function () {
            that.getService(that.deviceId);
          }, 5000)
        }
      },
      fail: function (err) {
        console.log('连接失败：', err);
        if (ltype == 'loop') {
          that.connectDeviceIndex += 1;
          that.loopConnect(array);
        } else {
          that.startBluetoothDevicesDiscovery();
          that.getConnectedBluetoothDevices();
        }
      },
      complete: function () {
        console.log('complete connect devices');
        this.isConnectting = false;
      }
    });
  },
  //获取蓝牙设备service值
  getService: function (deviceId) {
    var that = this;
    // 监听蓝牙连接
    wx.onBLEConnectionStateChange(function (res) {
      console.log(res);
    });
    // 获取蓝牙设备service值
    wx.getBLEDeviceServices({
      deviceId: deviceId,
      success: function (res) {
        console.log(res)
        that.getCharacter(deviceId, res.services);
      }
    })
  },
  getCharacter: function (deviceId, services) {
    var that = this;
    services.forEach(function (value, index, array) {
      if (value == that.serviceId) {
        that.serviceId = array[index];
      }
    });
    //读取服务的特征值
    wx.getBLEDeviceCharacteristics({
      deviceId: deviceId,
      serviceId: that.serviceId,
      success: function (res) {
        that.writeBLECharacteristicValue(deviceId, that.serviceId, that.characterId_write);
        that.openNotifyService(deviceId, that.serviceId, that.characterId_read);
      },
      fail: function (err) {
        console.log(err);
      },
      complete: function () {
        console.log('complete');
      }
    })
  },
  loopConnect: function (devicesId) {
    var that = this;
    var listLen = devicesId.length;
    if (devicesId[this.connectDeviceIndex]) {
      this.deviceId = devicesId[this.connectDeviceIndex];
      this.startConnectDevices('loop', devicesId);
    } else {
      console.log('已配对的设备小程序蓝牙连接失败');
      that.startBluetoothDevicesDiscovery();
      that.getConnectedBluetoothDevices();
    }
  }
})
