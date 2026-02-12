// pages/submit/submit.js
Page({
  data: {
    // 跑步截图（用于预览展示：临时路径）
    images: [],
    maxImages: 1,
    imageError: false,
    imageErrorMsg: '',

    // 步数截图（用于预览展示：临时路径）
    stepImages: [],
    maxStepImages: 1,
    stepImageError: false,
    stepImageErrorMsg: '',

    // 跑步方式选择
    modeOptions: ['全程在操场/在操场跑四圈', '在任意场地跑，提供步数截图'],
    modeIndex: 0,

    // 位置信息
    currentLocation: null,
    locationError: false,
    locationErrorMsg: '',

    // 提交状态
    submitting: false,
    submitDisabled: false,
    submitTextIndex: 0,
    submitTextList: ['提交记录', '未到提交时间', '今日停跑'],
  },

  onLoad() {
    if (!getApp().globalData.userInfo.stu_id) {
      wx.showToast({
        icon: 'error',
        title: '请先完善个人信息',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/finish-info/finish-info',
        })
      }, 1500)
    }
    // this.checkSubmissionAvailability()
  },

  onShow() {
    // this.checkSubmissionAvailability()
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
        images: [...this.data.images, ...newImages]
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

  async chooseStepImage() {
    if (this.data.submitting) return
    if (!wx.cloud) {
      wx.showModal({
        title: '错误',
        content: '云开发未初始化，请检查app.js中的wx.cloud.init',
        showCancel: false
      })
      return
    }

    try {
      const remain = this.data.maxStepImages - this.data.stepImages.length
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
        stepImages: [...this.data.stepImages, ...newImages]
      })
    } catch (error) {
      console.error('选择/上传步数截图失败:', error)
      if (error && error.errMsg && error.errMsg.includes('cancel')) return
      wx.showToast({ title: '步数截图上传失败', icon: 'none' })
    } finally {
      // 这里不涉及上传，不需要 loading 状态恢复
    }
  },

  deleteStepImage(e) {
    if (this.data.submitting) return
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    const stepImages = [...this.data.stepImages]
    stepImages.splice(index, 1)

    this.setData({ stepImages })
  },

  // 获取当前位置
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      console.log('开始获取当前位置...')
      
      // 检查位置权限
      wx.getSetting({
        success: (settingRes) => {
          if (!settingRes.authSetting['scope.userLocation']) {
            // 未授权，请求授权
            console.log('位置权限未授权，请求授权...')
            wx.authorize({
              scope: 'scope.userLocation',
              success: (authRes) => {
                if (authRes.errMsg === 'authorize:ok') {
                  this._getLocation(resolve, reject)
                } else {
                  reject(new Error('位置权限未授权'))
                }
              },
              fail: (err) => {
                reject(new Error('位置权限授权失败'))
              }
            })
          } else {
            // 已授权，直接获取位置
            this._getLocation(resolve, reject)
          }
        },
        fail: (err) => {
          reject(new Error('获取权限设置失败'))
        }
      })
    })
  },

  // 实际获取位置的方法
  _getLocation(resolve, reject) {
    console.log('开始获取位置坐标...')
    
    wx.getLocation({
      type: 'wgs84', // 使用WGS84坐标系统
      success: (res) => {
        const locationData = {
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy || 0
        }
        
        this.setData({
          currentLocation: locationData,
          locationError: false,
          locationErrorMsg: ''
        })
        
        console.log('获取位置成功:', locationData)
        resolve(locationData)
      },
      fail: (err) => {
        console.error('获取位置失败:', err)
        this.setData({
          locationError: true,
          locationErrorMsg: '获取位置失败，请检查位置权限或网络连接'
        })
        reject(new Error('获取位置失败'))
      }
    })
  },

  // 显示位置获取提示
  showLocationPrompt() {
    wx.showModal({
      title: '位置信息',
      content: '提交跑步记录需要获取您的位置信息，用于记录跑步地点',
      confirmText: '确定',
      showCancel: false
    })
  },

  async submitForm() {
    if (this.data.submitting) return
    if (!this.data.images || this.data.images.length === 0) {
      wx.showToast({
        icon: 'error',
        title: '请上传截图'
      })
      return
    }

    if (!wx.cloud) {
      wx.showModal({
        title: '错误',
        content: '云开发未初始化，请检查app.js中的wx.cloud.init',
        showCancel: false
      })
      return
    }

    const mode = this.data.modeOptions[this.data.modeIndex] || ''

    try {
      this.setData({
        submitting: true,
        submitDisabled: true,
        submitText: '获取位置中...'
      })
      
      // 0. 获取当前位置信息
      wx.showLoading({ title: '获取位置中...', mask: true })
      const location = await this.getCurrentLocation()
      
      this.setData({
        submitText: '上传中...'
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
      })

      wx.showToast({
        icon: 'success',
        title: '提交成功'
      })

      // 3. 在后台触发 OCR + 审核，不阻塞用户（传递位置信息）
      wx.cloud
        .callFunction({
          name: 'uploadRunningRecord',
          data: { 
            fileID, 
            mode, 
            ocrProvider: 'auto',
            coordinates: location // 传递位置坐标信息
          }
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
    }
  },
})