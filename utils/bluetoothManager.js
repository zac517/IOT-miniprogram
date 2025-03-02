// bluetoothManager.js
const bluetoothManager = {
  // 状态配置
  config: {
    discoveryDuration: 2000,   // 设备保留时长
    janitorInterval: 2000,      // 清理检测间隔
    scanInterval: 1000,         // 扫描间隔
    defaultTimeout: 8000
  },

  // 运行时状态
  connectionState: {
    isProcessing: false,
    currentDevice: null,
    timeoutTimer: null
  },

  // 状态变量
  adapterState: null,
  devices: [],
  pendingDiscovery: false,
  listeners: new Set(),
  janitorTimer: null,

  // 初始化蓝牙适配器
  initBluetooth(options = {}) {
    // 合并配置参数
    this.config = {
      ...this.config,
      ...(options.config || {})
    };

    // 注册设备监听器
    if (options.callbacks) {
      options.callbacks.forEach(callback => {
        if (typeof callback === 'function') {
          this.listeners.add(callback);
        }
      });
    }

    // 初始化流程
    this._handleStateChange(); // 持续监听适配器变化 不可用时尝试打开 首次由初始化程序打开
    this._startDeviceJanitor(); // 持续处理设备列表 清除超时设备
    this._checkAndOpenBluetooth(); // 尝试打开
  },

  // 处理适配器状态变化
  _handleStateChange() {
    wx.onBluetoothAdapterStateChange(res => {
      this.adapterState = res;
      if (!res.available) {
        this._checkAndOpenBluetooth();
      }
    });
  },

  // 清理超时蓝牙设备
  _startDeviceJanitor() {
    if (this.janitorTimer) return;

    this.janitorTimer = setInterval(() => {
        const now = Date.now();
        const threshold = now - this.config.discoveryDuration;

        let hasChange = false;
        // 倒序遍历列表，方便安全地删除元素
        for (let i = this.devices.length - 1; i >= 0; i--) {
            const device = this.devices[i];
            if (device.lastSeen < threshold) {
                // 删除过期的设备
                this.devices.splice(i, 1);
                hasChange = true;
            }
        }
        if (hasChange) this.listeners.forEach(cb => cb(this.devices));
    }, this.config.janitorInterval);
  },

  // 尝试开启蓝牙适配器
  _checkAndOpenBluetooth() {
    if (this.adapterState?.available) {
      if (this.pendingDiscovery) this._startDiscoveryInternal();
      return;
    };
    wx.openBluetoothAdapter({
      success: () => {
        if (this.pendingDiscovery) this._startDiscoveryInternal();
      },
      fail: () => {
        setTimeout(() => this._checkAndOpenBluetooth(), 2000);
      }
    });
  },

  // 启动扫描
  _startDiscoveryInternal() {
    wx.startBluetoothDevicesDiscovery({
      interval: this.config.scanInterval,
      allowDuplicatesKey: true,
      success: () => {
        this._listenDeviceFound();
      },
    });
  },

  // 发现设备后处理
  _listenDeviceFound() {
    wx.offBluetoothDeviceFound();

    this._deviceFoundCallback = res => {
      const now = Date.now();
      res.devices.forEach(device => {
        const manufacturerId = this._parseManufacturerId(device.advertisData);
        if (manufacturerId != "Luminalink") return;

        // 查找列表中是否已存在该设备
        let existingDeviceIndex = -1;
        for (let i = 0; i < this.devices.length; i++) {
          if (this.devices[i].deviceId === device.deviceId) {
            existingDeviceIndex = i;
            break;
          }
        }

        const newDevice = {
          name: device.name,
          deviceId: device.deviceId,
          lastSeen: now,
        };

        if (existingDeviceIndex !== -1) {
          // 如果存在重复的 deviceId，覆盖对应的值
          this.devices[existingDeviceIndex] = newDevice;
        } else {
          // 如果不存在，添加新设备到列表
          this.devices.push(newDevice);
        }
      });
      this.listeners.forEach(cb => cb(this.devices));
    };

    wx.onBluetoothDeviceFound(this._deviceFoundCallback);
  },

  // 解析制造商标识
  _parseManufacturerId(advertisData) {
    return String.fromCharCode.apply(null, new Uint8Array(advertisData));
  },

  // 启动设备搜索
  startDiscovery() {
    if (this.pendingDiscovery) return;
    if (this.adapterState?.available) {
      this._startDiscoveryInternal();
    }
    this.pendingDiscovery = true;
  },

  // 停止扫描
  stopDiscovery() {
    if (!this.pendingDiscovery) return;
    this.devices = [];
    wx.stopBluetoothDevicesDiscovery();
    this.pendingDiscovery = false;
  },

  // 关闭蓝牙
  closeBluetooth() {
    // 停止蓝牙设备扫描
    if (this.pendingDiscovery) {
      this.stopDiscovery();
    }

    // 清理守护进程
    if (this.janitorTimer) {
      clearInterval(this.janitorTimer);
      this.janitorTimer = null;
    }

    // 关闭蓝牙适配器
    if (this.adapterState?.available) {
      wx.closeBluetoothAdapter({
        success: () => {
          this.adapterState = null;
        },
      });
    }

    // 移除蓝牙适配器状态变化监听器
    wx.offBluetoothAdapterStateChange();

    // 移除蓝牙设备发现监听器
    wx.offBluetoothDeviceFound();

    // 清空监听器集合
    this.listeners.clear();
  },

  // 注册/注销监听
  addDeviceListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  },
  
  removeDeviceListener(callback) {
    this.listeners.delete(callback);
  },

  // 完整设备连接服务发现流程
  connectAndDiscoverServices({
    deviceId,
    serviceFilter = (services) => services[0],
    timeout = this.config.defaultTimeout,
    success,
    fail
  }) {
    if (this.connectionState.isProcessing) {
      return fail?.(new Error('已有连接操作在进行中'));
    }

    this._setProcessingState(true, deviceId);

    // 超时处理
    this.connectionState.timeoutTimer = setTimeout(() => {
      this._cleanupConnection();
      fail?.(new Error('操作超时'));
    }, timeout);

    // 开始连接流程
    wx.createBLEConnection({
      deviceId,
      success: () => {
        this._handleServiceDiscovery(deviceId, serviceFilter, success, fail);
      },
      fail: (err) => {
        this._cleanupConnection();
        fail?.(Object.assign(err, { type: 'CONNECTION_FAILED' }));
      }
    });
  },

  // 服务发现处理
  _handleServiceDiscovery(deviceId, serviceFilter, success, fail) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        try {
          const targetService = serviceFilter(res.services);
          if (!targetService) {
            throw new Error('未找到匹配服务');
          }
          this._cleanupConnection();
          success?.({ service: targetService, deviceId });
        } catch (error) {
          this._cleanupConnection();
          fail?.(error);
        }
      },
      fail: (err) => {
        this._cleanupConnection();
        fail?.(Object.assign(err, { type: 'SERVICE_DISCOVERY_FAILED' }));
      }
    });
  },

  // 状态管理
  _setProcessingState(isProcessing, deviceId = null) {
    this.connectionState = {
      isProcessing,
      currentDevice: deviceId,
      timeoutTimer: this.connectionState.timeoutTimer
    };
  },

  // 清理操作
  _cleanupConnection() {
    clearTimeout(this.connectionState.timeoutTimer);
    
    if (this.connectionState.currentDevice) {
      wx.closeBLEConnection({
        deviceId: this.connectionState.currentDevice,
        complete: () => {
          this._setProcessingState(false);
        }
      });
    } else {
      this._setProcessingState(false);
    }
  },
};

export default bluetoothManager;