// pages/submit/submit.js
Page({
  data: {
    stu_id: '',
    
    // 跑步数据
    date: '',
    locationIndex: 0,
    locationOptions: ['全程在操场上跑四圈', '在校园内其他地方跑'],
    images: [],
    
    // 表单验证
    dateError: false,
    dateErrorMsg: '',
    imageError: false,
    imageErrorMsg: '',
    
    // 上传配置
    maxImages: 3,
    
    // 提交状态
    submitDisabled: false,
    submitText: '提交记录',
    showSuccess: false
  },

  onLoad(options) {
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`
    this.setData({
      date: formattedDateTime
    })    
    this.loadStuId()
  },

  loadStuId() {
    try {
      const app = getApp()
      const stuId = app.globalData.userInfo.stu_id
      
      if (!stuId) {
        wx.showToast({
          title: '请先录入学号',
          icon: 'none'
        })
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/user-info/user-info'
          })
        }, 1500)
        return
      }
      
      this.setData({
        stu_id: stuId
      })
    } catch (error) {
      console.error('学号加载失败:', error)
    }
  },
  
  /**
   * 跑步地点变化事件
   */
  onLocationChange(e) {
    this.setData({
      locationIndex: e.detail.value
    })
  },
  
  /**
   * 表单验证 - 跑步截图
   */
  validateImages(images) {
    if (images.length === 0) {
      this.setData({
        imageError: true,
        imageErrorMsg: '请至少上传一张跑步截图'
      })
      return false
    }
    
    this.setData({
      imageError: false,
      imageErrorMsg: ''
    })
    return true
  },
  
  /**
   * 选择图片
   */
  chooseImage() {
    const that = this
    const maxCount = this.data.maxImages - this.data.images.length
    
    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success(res) {
        console.log('选择图片成功:', res)
        
        // 处理选择的图片
        const tempFiles = res.tempFiles
        const newImages = tempFiles.map(file => file.tempFilePath)
        
        // 更新图片列表
        that.setData({
          images: [...that.data.images, ...newImages]
        })
        
        // 验证图片
        that.validateImages(that.data.images)
      },
      fail(err) {
        console.error('选择图片失败:', err)
        if (err.errMsg !== 'chooseMedia:fail cancel') {
          wx.showToast({
            title: '选择图片失败，请重试',
            icon: 'none'
          })
        }
      }
    })
  },
  
  /**
   * 删除图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images
    images.splice(index, 1)
    
    this.setData({
      images: images
    })
    
    // 验证图片
    this.validateImages(images)
  },
  
  /**
   * 上传图片到云存储
   */
  uploadImages() {
    const that = this
    const images = this.data.images
    const uploadPromises = []
    
    // 上传每张图片
    for (let i = 0; i < images.length; i++) {
      const filePath = images[i]
      const cloudPath = `running-records/${Date.now()}-${i}.${filePath.match(/\.(\w+)$/)[1]}`
      
      const promise = new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath,
          success: res => {
            resolve(res.fileID)
          },
          fail: err => {
            console.error('上传图片失败:', err)
            reject(err)
          }
        })
      })
      
      uploadPromises.push(promise)
    }
    
    return Promise.all(uploadPromises)
  },
  
  /**
   * 调用云函数进行OCR识别 - 真实从图片提取数据
   */
  ocrRecognize(filePaths) {
    const that = this;
    const filePath = filePaths[0]; // 使用第一张图片进行OCR识别
    
    // 返回一个Promise，用于处理异步流程
    return new Promise(function(resolve, reject) {
      console.log('=== 开始OCR识别流程 ===');
      console.log('使用图片:', filePath);
      
      // 1. 先上传图片到云存储
      const timestamp = Date.now();
      const fileExtension = filePath.match(/\.([^.]+)$/);
      const extension = fileExtension ? fileExtension[1] : 'jpg';
      const cloudPath = `ocr/${timestamp}.${extension}`;
      console.log('上传图片到云存储，cloudPath:', cloudPath);
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: function(uploadRes) {
          const fileID = uploadRes.fileID;
          console.log('图片上传成功，fileID:', fileID);
          
          // 2. 调用OCR云函数
          console.log('开始调用OCR云函数...');
          
          wx.cloud.callFunction({
            name: 'ocr',
            data: {
              fileID: fileID
            },
            success: function(ocrRes) {
              console.log('OCR云函数调用成功，结果:', ocrRes);
              
              // 3. 提取OCR文本
              let ocrText = '';
              if (ocrRes && ocrRes.result) {
                if (ocrRes.result.code === 200 && ocrRes.result.data) {
                  ocrText = ocrRes.result.data.ocrText;
                  console.log('提取到的OCR文本:', ocrText);
                  
                  // 4. 解析OCR文本
                  const parsedData = that.parseOcrResult(ocrText);
                  console.log('OCR文本解析结果:', parsedData);
                  
                  // 5. 显示解析结果
                  wx.showToast({
                    title: 'OCR识别成功',
                    icon: 'success',
                    duration: 1500
                  });
                } else {
                  console.error('OCR识别失败:', ocrRes.result.message || '未知错误');
                  wx.showToast({
                    title: `OCR识别失败: ${ocrRes.result.message || '未知错误'}`,
                    icon: 'none',
                    duration: 2000
                  });
                }
              } else {
                console.error('OCR云函数返回结果格式不正确:', ocrRes);
                wx.showToast({
                  title: 'OCR云函数返回结果格式不正确',
                  icon: 'none',
                  duration: 2000
                });
              }
              
              // 6. 返回OCR文本
              console.log('=== OCR识别流程结束 ===');
              resolve(ocrText);
            },
            fail: function(err) {
              console.error('OCR云函数调用失败:', err);
              
              // 显示友好的错误提示
              let errorMsg = 'OCR识别失败，请稍后重试';
              if (err.errCode === -501001) {
                errorMsg = '云函数不存在，请检查云函数是否已部署';
              } else if (err.errCode === -501002) {
                errorMsg = '云函数调用失败，请检查网络连接';
              } else if (err.errCode === -501003) {
                errorMsg = '云函数执行失败，请检查云函数日志';
              }
              
              wx.showToast({
                title: errorMsg,
                icon: 'none',
                duration: 2000
              });
              
              // 云函数调用失败时，返回空字符串
              console.log('=== OCR识别流程结束 ===');
              resolve('');
            }
          });
        },
        fail: function(err) {
          console.error('图片上传失败:', err);
          wx.showToast({
            title: '图片上传失败，请检查网络连接',
            icon: 'none',
            duration: 2000
          });
          console.log('=== OCR识别流程结束 ===');
          resolve('');
        }
      });
    });
  },
  
  /**
   * 解析OCR识别结果
   */
  parseOcrResult(ocrText) {
    const result = {};
    
    console.log('开始解析OCR文本:', ocrText);
    
    // 1. 提取日期时间（支持多种格式）
    const dateRegexes = [
      /(\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}[\s]*[\d:]+)/, // 2026-01-27 14:30
      /(\d{4}年\d{1,2}月\d{1,2}日[\s]*[\d:]+)/, // 2026年1月27日 14:30
      /(\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2})/, // 2026-01-27
      /(\d{4}年\d{1,2}月\d{1,2}日)/ // 2026年1月27日
    ];
    
    for (const regex of dateRegexes) {
      const match = ocrText.match(regex);
      if (match) {
        result.date = match[1];
        console.log('提取到日期时间:', result.date);
        break;
      }
    }
    
    // 2. 提取里程（支持多种格式）
    const distanceRegexes = [
      /(?:里程|距离):?\s*(\d+(\.\d+)?)[\s]*(?:km|公里|千米)/i, // 里程: 5.0km
      /(\d+(\.\d+)?)[\s]*(?:km|公里|千米)/i, // 5.0km
      /(?:里程|距离):?\s*(\d+(\.\d+)?)/i // 里程: 5.0
    ];
    
    for (const regex of distanceRegexes) {
      const match = ocrText.match(regex);
      if (match) {
        result.distance = match[1] + 'km';
        console.log('提取到里程:', result.distance);
        break;
      }
    }
    
    // 3. 提取时长（支持多种格式）
    const durationRegexes = [
      /(?:时长|时间|用时):?\s*(\d{1,2}:\d{2}:\d{2})/i, // 时长: 00:25:30
      /(?:时长|时间|用时):?\s*(\d{1,2}:\d{2})/i, // 时长: 25:30
      /(\d{1,2}:\d{2}:\d{2})/i, // 00:25:30
      /(\d{1,2}:\d{2})/i // 25:30
    ];
    
    for (const regex of durationRegexes) {
      const match = ocrText.match(regex);
      if (match) {
        result.duration = match[1];
        console.log('提取到时长:', result.duration);
        break;
      }
    }
    
    // 4. 提取配速（支持多种格式）
    const paceRegexes = [
      /配速:?\s*(\d+'\d+"?)/i, // 配速: 5'30"
      /配速:?\s*(\d+:\d+)/i, // 配速: 5:30
      /(\d+'\d+"?)/i, // 5'30"
      /(\d+:\d+)[\s]*(?:min|分钟)/i // 5:30 min
    ];
    
    for (const regex of paceRegexes) {
      const match = ocrText.match(regex);
      if (match) {
        result.pace = match[1];
        console.log('提取到配速:', result.pace);
        break;
      }
    }
    
    // 5. 提取姓名
    const nameRegexes = [
      /(?:姓名|昵称):?\s*(\S+)/i, // 姓名: 张三
      /(?:name|nickname):?\s*(\S+)/i, // name: 张三
      /(\S+)\s*(?:同学|用户)/i // 张三 同学
    ];
    
    for (const regex of nameRegexes) {
      const match = ocrText.match(regex);
      if (match) {
        result.name = match[1];
        console.log('提取到姓名:', result.name);
        break;
      }
    }
    
    // 6. 提取学号
    const stuIdRegexes = [
      /(?:学号|学号|ID|id):?\s*(\d+)/i, // 学号: 20230101
      /(\d{8,12})/ // 8-12位数字学号
    ];
    
    for (const regex of stuIdRegexes) {
      const match = ocrText.match(regex);
      if (match) {
        result.stu_id = match[1];
        console.log('提取到学号:', result.stu_id);
        break;
      }
    }
    
    console.log('OCR文本解析结果:', result);
    return result;
  },
  
  /**
   * 表单提交
   */
  submitForm() {
    const isImagesValid = this.validateImages(this.data.images)
    
    if (!isImagesValid) {
      wx.showToast({
        title: '请完善表单信息',
        icon: 'none'
      })
      return
    }
    
    // 开始提交
    this.setData({
      submitDisabled: true,
      submitText: '提交中...'
    })
    
    // 显示加载状态
    wx.showLoading({
      title: '提交中...',
      mask: true
    })
    
    const that = this
    const localFilePaths = this.data.images
    
    // 1. 先进行OCR识别，使用本地文件路径
    this.ocrRecognize(localFilePaths)
      .then(ocrText => {
        console.log('OCR识别成功:', ocrText)
        
        // 2. 上传图片到云存储
        return that.uploadImages()
          .then(fileIDs => {
            return {
              fileIDs,
              ocrText
            }
          })
      })
      .then(({ fileIDs, ocrText }) => {
        console.log('图片上传成功:', fileIDs)
        
        // 3. 调用云函数提交跑步记录，使用uploadRunningRecord而不是submitRunningRecord
        // 注意：uploadRunningRecord只接受单个fileID，我们使用第一个图片的fileID
        const fileID = fileIDs[0]
        return wx.cloud.callFunction({
          name: 'uploadRunningRecord',
          data: {
            fileID: fileID,  // 按照后端要求添加fileID参数
            ocrText: ocrText   // 按照后端要求添加ocrText参数
          }
        })
      })
      .then(res => {
        console.log('提交记录成功:', res)
        
        // 隐藏加载状态
        wx.hideLoading()
        
        // 显示成功提示
        that.setData({
          showSuccess: true
        })
        
        // 重置表单
        that.resetForm()
      })
      .catch(err => {
        console.error('提交失败:', err)
        
        // 隐藏加载状态
        wx.hideLoading()
        
        // 显示错误提示
        wx.showToast({
          title: '提交失败，请稍后重试',
          icon: 'none'
        })
        
        // 恢复提交状态
        that.setData({
          submitDisabled: false,
          submitText: '提交记录'
        })
      })
  },
  
  /**
   * 重置表单
   */
  resetForm() {
    // 重新设置当前日期时间，精确到分钟
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`
    
    // 重置表单数据
    this.setData({
      date: formattedDateTime,
      locationIndex: 0,
      images: [],
      
      // 重置表单验证
      dateError: false,
      dateErrorMsg: '',
      imageError: false,
      imageErrorMsg: '',
      
      // 重置提交状态
      submitDisabled: false,
      submitText: '提交记录'
    })
  },
  
  /**
   * 关闭成功提示
   */
  onSuccessClose() {
    this.setData({
      showSuccess: false
    })
  },
  
  /**
   * 阻止模态框背景滚动
   */
  preventTouchMove() {
    // 阻止模态框背景滚动
  }
})
