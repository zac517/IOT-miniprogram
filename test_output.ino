#include "UTF8ToGB2312.h"
//void speech(String data) {
//  String utf8_str = data;
//  String gb2312_str = GB.get(utf8_str);
//  unsigned char head[gb2312_str.length()+6];
// 
// 
//  // 定义无符号字符类型数组，将 GB2312 编码的字符串复制到数组中
//  unsigned char gb2312_data[gb2312_str.length() + 1];
//  memset(gb2312_data, 0, sizeof(gb2312_data));
//  strncpy((char*)gb2312_data, gb2312_str.c_str(), gb2312_str.length());
// 
//  head[0] = 253;
//  head[1] = 0;
//  head[2] = gb2312_str.length()+3;
//  head[3] = 1;
//  head[4] = 0;
//  // 输出转换后的字符数组的16进制值
//  for (int i = 5; i < gb2312_str.length()+5; i++) {
//    head[i] = gb2312_data[i-5];
//  }
//  // 计算前面异或值之和并输出
//  head[gb2312_str.length()+5]=head[0];
//  for (int i = 1; i < gb2312_str.length()+5; i++) {
//    head[gb2312_str.length()+5] ^= head[i];
//  }
//  for(int j = 0; j < sizeof(head); j++){
//    Serial2.write(head[j]);
//  }
//    
//}
// 
// 
//void setup() {
//  Serial2.begin(9600);
//}
// 
//void loop() {
//  speech("等我攒够6999元就去买华为！");
//  delay(8000); // 停留8秒钟
//}
#include <HardwareSerial.h>

#include "UTF8ToGB2312.h"

// 创建一个硬件串口对象，使用 Serial2
HardwareSerial mySerial(2);  // 使用串口2（TX=17, RX=16）

void SYN_FrameInfo(String text)
{
  unsigned char Frame_Info[50];  // 用于存储构建的帧数据
  unsigned char HZ_Length;
  unsigned char ecc  = 0;        // 校验字节
  unsigned int i = 0;
  
  // 转换文本到 GB2312 编码
  String gb2312Text = GB.get(text);  // 使用 GB.get() 将 UTF-8 转为 GB2312
  
  HZ_Length = gb2312Text.length();  // 获取转换后的文本长度
  
  // 固定帧头部分
  Frame_Info[0] = 0xFD;         // 帧头
  Frame_Info[1] = 0x00;         // 数据长度高字节
  Frame_Info[2] = HZ_Length + 3; // 数据长度低字节，包括命令和数据部分
  Frame_Info[3] = 0x01;         // 合成播放命令
  Frame_Info[4] = 0x01 | 0 << 4;  // 参数：背景音乐（1表示有背景音乐）

  // 校验码计算
  for(i = 0; i < 5; i++) {
    ecc = ecc ^ (Frame_Info[i]);  // 计算帧头的校验字节
  }

  for(i = 0; i < HZ_Length; i++) {
    ecc = ecc ^ (gb2312Text[i]);  // 计算文本数据的校验字节
  }

  // 将文本数据拷贝到帧中
  for(i = 0; i < HZ_Length; i++) {
    Frame_Info[5 + i] = gb2312Text[i];  // 拷贝文本到帧中
  }
  
  // 添加校验码到帧末尾
  Frame_Info[5 + HZ_Length] = ecc;

  // 通过串口发送数据帧
  mySerial.write(Frame_Info, 5 + HZ_Length + 1);  // 发送整个数据帧
}

void setup() {
  // 初始化串口监视器用于调试
  Serial.begin(9600);
  
  // 初始化硬件串口2，用于与Syn6288模块通信
  mySerial.begin(9600, SERIAL_8N1, 16, 17);  // 使用TX=17, RX=16（根据你的接线来配置）
  
  // 等待串口初始化
  delay(1000);
  
  // 发送语音合成命令
  String text = "你好，世界";  // 要合成的文本
  SYN_FrameInfo(text);  // 发送文本
}

void loop() {
  // 在这里可以添加其他逻辑
}
