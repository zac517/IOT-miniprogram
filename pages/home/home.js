import CommunicationManager from '../../utils/communicationManager'

Page({
  data: {
      devices: [],
      isOnSelect: false,
      isSelectedAll: false,
      selectedCount: 0,
      commManager: null,
  },

  refresh() {
    // 检测设备状态
    const deviceIds = this.data.devices.map(device => device.deviceId);
    this.data.commManager.checkMultipleOnlineStatus(deviceIds).then(statusMap => {
      let newDevices = [...this.data.devices];
      newDevices.forEach(device => {
        device.isOnline = statusMap.get(device.deviceId);
      });
      this.setData({
        devices: newDevices,
      })
      wx.stopPullDownRefresh();
    });
  },

  // 开始选择函数
  startSelect(e) {
      this.setData({
          isOnSelect: true,
      });
  },

  // 全选函数
  selectAll() {
      const devices = this.data.devices.map(device => ({
          ...device,
          isSelected: true
      }));
      const selectedCount = devices.length;
      this.setData({
          devices,
          selectedCount,
          isSelectedAll: true,
      });
  },

  // 取消全选函数
  cancelSelectAll() {
      const devices = this.data.devices.map(device => ({
          ...device,
          isSelected: false
      }));
      this.setData({
          devices,
          selectedCount: 0,
          isSelectedAll: false,
      });
  },

  // 取消选择函数
  cancelSelect() {
      this.cancelSelectAll();
      this.setData({
          isOnSelect: false,
      });
  },

  // 删除选中设备的函数
  deleteSelected() {
      if (this.data.selectedCount > 0) {
          wx.showModal({
              title: '确认删除',
              content: '确定要删除选中的设备吗？',
              success: (res) => {
                  if (res.confirm) {
                      const devices = this.data.devices.filter(device =>!device.isSelected);
                      const selectedCount = 0;
                      this.setData({
                          devices,
                          selectedCount,
                          isSelectedAll: false,
                      });
                      this.cancelSelect();
                  }
              }
          });
      }
  },

  // 处理选中事件函数
  handleCheckboxChange(e) {
      const selectedDevice = e.currentTarget.dataset.device;
      const devices = this.data.devices;
      const newDevices = [...devices];
      let isSelectedAll = true;
      let selectedCount = 0;

      // 遍历设备列表，更新每个设备的选中状态
      newDevices.forEach((device) => {
          if (device.id === selectedDevice.id) {
              // 找到当前点击的设备，切换其选中状态
              device.isSelected = !device.isSelected;
          }
          if (device.isSelected) {
              selectedCount++;
          } else {
              isSelectedAll = false;
          }
      });

      this.setData({
          devices: newDevices,
          selectedCount,
          isSelectedAll
      });
  },

  // 卡片长按事件函数
  cardLongpress(e) {
      wx.vibrateShort({
          type: "light",
          success: () => {
              if (!this.data.isOnSelect) {
                  this.startSelect();
              }
              this.handleCheckboxChange(e);
          }
      });
  },

  // 卡牌点击事件函数
  cardTap(e) {
    if (this.data.isOnSelect) {
      this.handleCheckboxChange(e);
    }
    else {
      if (e.currentTarget.dataset.device.manufacturer == "Luminalink") {
        wx.redirectTo({
          url: '/pages/control/control',
        })
      }
      else {
        wx.showToast({
          title: '暂不支持控制此类设备',
          icon: 'none'
        });
      }
    }
  },

  // 重命名函数
  renameDevice() {
      const selectedDevice = this.data.devices.find(device => device.isSelected);
      if (selectedDevice) {
          wx.showModal({
              title: '重命名设备',
              placeholderText: selectedDevice.name,
              editable: true,
              success: (res) => {
                  if (res.confirm) {
                      const newName = res.content;
                      if (newName) {
                          const newDevices = this.data.devices.map(device => {
                              if (device.id === selectedDevice.id) {
                                  return {
                                      ...device,
                                      name: newName
                                  };
                              }
                              return device;
                          });
                          this.setData({
                              devices: newDevices
                          });
                          this.cancelSelect();
                      }
                  }
              }
          });
      }
  },

  // 跳转到设备选择函数
  selectManufacturer() {
      wx.redirectTo({
          url: `/pages/manufacturer/manufacturer?devices=${this.data.devices}`,
      });
  },

  onLoad(options) {
    this.setData({
      devices: wx.getStorageSync('devices'),
    });
    this.cancelSelectAll();
    this.data.commManager = new CommunicationManager();
    this.data.commManager.init();
  },

  onHide() {
      wx.setStorageSync('devices', this.data.devices);
  },

  onUnload() {
      wx.setStorageSync('devices', this.data.devices);
      this.data.commManager.close();
  },

  onPullDownRefresh() {
    wx.vibrateShort({
      type: "light",
      success: () => {
        this.refresh();
      }
    }); 
  },
});