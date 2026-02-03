// pages/submit/submit.js
Page({
  data: {
    // 图片（用于预览展示：临时路径）
    images: [],
    maxImages: 1,
    imageError: false,
    imageErrorMsg: '',

    // 跑步方式选择
    modeOptions: ['全程在操场/在操场跑四圈', '在任意场地跑，提供步数截图'],
    modeIndex: 0,

    // 提交状态
    submitDisabled: false,
    submitTextIndex: 0,
    submitTextList: ['提交记录', '未到提交时间', '今日停跑'],

    // 成功弹窗
    showSuccess: false
  },

  onLoad() {
    this.checkSubmissionAvailability()
  },

  onShow() {
    this.checkSubmissionAvailability()
  },

  checkSubmissionAvailability() {
    // TODO: 检查今天是否停跑
    // 检查现在的时间是不是晚上8点到10点之间
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = 20 * 60;
    const endMinutes = 22 * 60 + 5;
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      this.setData({
        submitDisabled: true,
        submitTextIndex: 1
      })
    }
  },

  onModeChange(e) {
    this.setData({
      modeIndex: Number(e.detail.value || 0)
    })
  },

  async chooseImage() {
    if (this.data.submitting) return
    if (!wx.cloud) {
      wx.showModal({
        title: '错误',
        content: '云开发未初始化，请检查app.js中的wx.cloud.init',
        showCancel: false
      })
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/user-info/user-info'
        })
      }, 1500)
      return
    }

    try {
      const remain = this.data.maxImages - this.data.images.length
      if (remain <= 0) return

      const res = await wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      })

      const tempFiles = res.tempFiles || []
      if (tempFiles.length === 0) return

      // 只在本地展示预览，不在这里上传；上传放到提交时统一处理
      const newImages = tempFiles.map(f => f.tempFilePath)
      this.setData({
        images: [...this.data.images, ...newImages],
        imageError: false,
        imageErrorMsg: ''
      })
    } catch (error) {
      console.error('选择/上传图片失败:', error)
      if (error && error.errMsg && error.errMsg.includes('cancel')) return
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      // 这里不涉及上传，不需要 loading 状态恢复
    }
  },

  deleteImage(e) {
    if (this.data.submitting) return
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    const images = [...this.data.images]
    images.splice(index, 1)

    this.setData({ images })
  },

  validateForm() {
    let ok = true

    if (!this.data.images || this.data.images.length === 0) {
      ok = false
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

    const mode = this.data.modeOptions[this.data.modeIndex] || ''

    try {
      this.setData({
        submitting: true,
        submitDisabled: true,
        submitText: '提交中...'
      })
      wx.showLoading({ title: '上传中...', mask: true })

      // 1. 上传首张截图到云存储
      const tempFilePath = this.data.images[0]
      const cloudPath = `running-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      })
      const fileID = uploadRes.fileID

      wx.hideLoading()

      // 2. 前端视角：上传成功即视为提交成功
      this.setData({
        images: [],
        imageError: false,
        imageErrorMsg: '',
        showSuccess: true
      })

      // 3. 在后台触发 OCR + 审核，不阻塞用户
      wx.cloud
        .callFunction({
          name: 'uploadRunningRecord',
          data: { fileID, mode, ocrProvider: 'auto' }
        })
        .then(res => {
          console.log('后台OCR审核完成:', res)
        })
        .catch(err => {
          console.error('后台OCR审核失败:', err)
        })
    } catch (error) {
      console.error('提交失败:', error)
      wx.hideLoading()
      wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
    } finally {
      this.setData({
        submitting: false,
        submitDisabled: false,
        submitText: '提交审核'
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
    }
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
