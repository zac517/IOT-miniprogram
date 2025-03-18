import CommunicationManager from '../../utils/communicationManager'
import { mixColors } from '../../utils/util'

Page({
  data: {
    name: '',
    deviceId: '',

    isOpen: false,

    brightness: 30,

    color: 0,
    coolColor: '#ffffff',
    warmColor: '#ffddbb',
    realColor: '#ffffff',

    mode: 0,
    modeLabel: ['均衡', '夜间', '专注', '自动'],

    isWiFiOpen: false,
    isWiFiConnected: false,

    buttons: [
      {
        name: 'power',
        type: 'tap',
        label: '',
        isPressed: false,
        bindTap(that) {
          const newIsOpen =! that.data.isOpen;
          that.setData({
            isOpen: newIsOpen,
          });
          return JSON.stringify({ power: newIsOpen? 'on' : 'off' });
        },
      },
      {
        name: 'brightness',
        type: 'drag',
        label: '亮度',
        startX: 0,
        startValue: 0,
        left: 0,
        getValue: (that) => that.data.brightness,
        setValue: (that, brightness) => {
          that.setData({
            brightness,
          })
        },
      },
      {
        name: 'color',
        type: 'drag',
        label: '色温',
        startX: 0,
        startValue: 0,
        left: 0,
        getValue: (that) => that.data.color,
        setValue: (that, color) => {
          that.setData({
            color,
            realColor: mixColors(that.data.warmColor, that.data.coolColor, color / 100),
          })
        },
      },
      {
        name: 'mode',
        type: 'tap',
        label: '模式',
        isPressed: false,
        bindTap(that) {
          let newMode = that.data.mode;
          if (newMode === 3) {
            newMode = 0;
          } else {
            newMode++;
          }
          that.setData({
            mode: newMode,
          });
          return JSON.stringify({ mode: newMode });
        },
      },
      {
        name: 'wifi',
        type: 'tap',
        label: 'WiFi',
        isPressed: false,
        bindTap(that) {
          const newIsWiFiOpen = !that.data.isWiFiOpen;
          that.setData({
            isWiFiOpen: newIsWiFiOpen,
          });
          return JSON.stringify({ wifi: newIsWiFiOpen? 'on' : 'off' });
        },
      },
      {
        name: 'config',
        type: 'tap',
        label: '配网',
        isPressed: false,
      },
    ],
    
    dragWidth: 0,
  },

  async onLoad(options) {
    this.setData({
      name: options.name,
      deviceId: options.deviceId,
    });
    let deviceId = this.data.deviceId;

    CommunicationManager.begin({
      onStateChange: async (state) => {
        console.log(state);
      },
      onMessageReceived: (deviceId, message) => {
        this.handleReceivedMessage(deviceId, message);
      },
      task: {
        setup: () => CommunicationManager.connect(deviceId),
        recover: () => CommunicationManager.connect(deviceId),
        end: () => CommunicationManager.disconnect(deviceId),
      }
    });
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query.select('.long-button').boundingClientRect((rect) => {
      if (rect) {
        console.log(rect.left);
        this.setData({
          dragWidth: rect.width,
        });
        this.data.buttons[1].left = rect.left;
      }
    }).exec();
  },

  onUnload() {
    CommunicationManager.finish();
  },
  
  dragStart(e) {
    const index = e.currentTarget.dataset.index;
    const button = this.data.buttons[index];
    button.startX = e.changedTouches[0].clientX;
    button.startValue = button.getValue(this);
  },

  dragTouch(e) {
    const index = e.currentTarget.dataset.index;
    const button = this.data.buttons[index];
    const value = Math.floor(Math.max(0, Math.min(button.startValue + (e.changedTouches[0].clientX - button.startX) / this.data.dragWidth * 100, 100)));
    button.setValue(this, value);
  },

  async dragEnd(e) {
    const index = e.currentTarget.dataset.index;
    const button = this.data.buttons[index];
    if (e.changedTouches[0].clientX == button.startX) {
      const value = Math.floor((e.changedTouches[0].clientX - button.left) / this.data.dragWidth * 100);
      button.setValue(this, value);
    };
    let message = '';
    if (button.name == 'brightness') message = JSON.stringify({ bn: this.data.brightness});
    else if (button.name == 'color') message = JSON.stringify({ color: this.data.color});
    try {
      await CommunicationManager.sendMessage(this.data.deviceId, message);
      console.log(`消息发送成功，内容: ${message}`);
    } catch (err) {
      console.error(`消息发送失败，内容: ${message}`, err);
    }
  },

  onTouchStart(e) {
    let index = e.currentTarget.dataset.index;
    let newButton = { ...this.data.buttons[index], isPressed: true };
    let newButtons = [...this.data.buttons];
    newButtons[index] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onTouchEnd(e) {
    let index = e.currentTarget.dataset.index;
    let newButton = { ...this.data.buttons[index], isPressed: false };
    let newButtons = [...this.data.buttons];
    newButtons[index] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onTap(e) {
    let index = e.currentTarget.dataset.index;
    wx.vibrateShort({
      type: "medium",
      success: async () => {
        if (this.data.buttons[index].name == 'config') {
          wx.navigateTo({
            url: `/pages/setup/setup?deviceId=${this.data.deviceId}`,
          });
        }
        else {
          const deviceId = this.data.deviceId;
        const message = this.data.buttons[index].bindTap(this);
        try {
          await CommunicationManager.sendMessage(deviceId, message);
          console.log(`消息发送成功，内容: ${message}`);
        } catch (err) {
          console.error(`消息发送失败，内容: ${message}`, err);
        }
        }
      },
    });
  },

  backToHome() {
    wx.navigateBack();
  },

  handleReceivedMessage(deviceId, message) {
    console.log(`收到消息 (${deviceId}):`, message);
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.power) {
        this.setData({
          isOpen: parsedMessage.power === 'on'
        });
      }
      if (parsedMessage.mode !== undefined) {
        this.setData({
          mode: parsedMessage.mode
        });
      }
      if (parsedMessage.bn !== undefined) {
        this.setData({
          brightness: parsedMessage.bn
        });
      }
      if (parsedMessage.color!== undefined) {
        this.setData({
          color: parsedMessage.color
        });
      }
      if (parsedMessage.wifi) {
        this.setData({
          isWiFiOpen: parsedMessage.wifi !== 'off',
          isWiFiConnected: parsedMessage.wifi === 'true'
        });
      }
    } catch (err) {
      console.error('解析消息失败:', err);
    }
  }
});