// pages/submit/submit.js
Page({
  data: {
    // 跑步截图（临时路径）
    images: [],
    maxImages: 1,

    // 步数截图（临时路径）
    stepImages: [],
    maxStepImages: 1,

    // 跑步方式选择
    modeOptions: ['全程在操场/在操场跑四圈', '在任意场地跑，提供步数截图'],
    modeIndex: 0,
    dropdownOpen: false,

    // 位置信息
    currentLocation: null,

    // 提交状态
    submitting: false,
    submitDisabled: true,
    submitTextIndex: 3,
    submitTextList: ['提交', '未到提交时间', '已被禁跑', ''],

    // 禁跑状态
    isBanned: false,
    banRemainingDays: 0,

    // 停跑状态
    isPending: false,
    pendIngReason: ''
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
    this.checkSubmissionAvailability()
  },

  onShow() {
    this.checkSubmissionAvailability()
  },

  // 检查提交可用性
  async checkSubmissionAvailability() {
    const app = getApp()
    // 禁跑检查
    if (app.globalData.userInfo.status === 1) {
      this.setData({
        submitDisabled: true,
        submitTextIndex: 2,
        isBanned: true,
        banRemainingDays: app.globalData.userInfo.ban_remaining_days
      })
      return
    }

    // 时间段检查
    // const now = new Date()
    // const currentMinutes = now.getHours() * 60 + now.getMinutes()
    // const startMinutes = 20 * 60
    // const endMinutes = 22 * 60 + 30
    // if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    //   this.setData({ submitDisabled: true, submitTextIndex: 1 })
    //   return
    // }

    this.setData({
      submitDisabled: false,
      submitTextIndex: 0
    })
  },

  toggleDropdown() {
    this.setData({
      dropdownOpen: !this.data.dropdownOpen
    })
  },

  selectMode(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isNaN(index)) {
      this.setData({
        modeIndex: index,
        dropdownOpen: false
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

      const newImages = tempFiles.map(f => f.tempFilePath)
      this.setData({
        images: [...this.data.images, ...newImages]
      })
    } catch (error) {
      console.error('选择图片失败:', error)
      if (error && error.errMsg && error.errMsg.includes('cancel')) return
      wx.showToast({
        title: '选择图片失败',
        icon: 'none'
      })
    }
  },

  deleteImage(e) {
    if (this.data.submitting) return
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    const images = [...this.data.images]
    images.splice(index, 1)
    this.setData({
      images
    })
  },

  async chooseStepImage() {
    if (this.data.submitting) return

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

      const newImages = tempFiles.map(f => f.tempFilePath)
      this.setData({
        stepImages: [...this.data.stepImages, ...newImages]
      })
    } catch (error) {
      console.error('选择步数截图失败:', error)
      if (error && error.errMsg && error.errMsg.includes('cancel')) return
      wx.showToast({
        title: '选择步数截图失败',
        icon: 'none'
      })
    }
  },

  deleteStepImage(e) {
    if (this.data.submitting) return
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    const stepImages = [...this.data.stepImages]
    stepImages.splice(index, 1)
    this.setData({
      stepImages
    })
  },

  // 获取当前位置
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (settingRes) => {
          if (!settingRes.authSetting['scope.userLocation']) {
            wx.authorize({
              scope: 'scope.userLocation',
              success: () => this._getLocation(resolve, reject),
              fail: () => reject(new Error('位置权限未授权'))
            })
          } else {
            this._getLocation(resolve, reject)
          }
        },
        fail: () => reject(new Error('获取权限设置失败'))
      })
    })
  },

  _getLocation(resolve, reject) {
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        const locationData = {
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy || 0
        }
        this.setData({
          currentLocation: locationData
        })
        resolve(locationData)
      },
      fail: (err) => {
        reject(new Error('获取位置失败'))
      }
    })
  },

  // 提交表单
  async submitForm() {
    if (this.data.submitting) return
  
    // 基础校验
    if (!this.data.images || this.data.images.length === 0) {
      wx.showToast({ icon: 'error', title: '请上传跑步截图' })
      return
    }
    if (this.data.modeIndex === 1 && (!this.data.stepImages || this.data.stepImages.length === 0)) {
      wx.showToast({ icon: 'error', title: '请上传步数截图' })
      return
    }
  
    let uploadedFileIDs = []
    try {
      wx.showLoading({ title: '提交中', mask: true })
      this.setData({ submitting: true, submitDisabled: true })

      // 1. 前置检查（调用 checkSubmission 云函数）
      const checkRes = await wx.cloud.callFunction({
        name: 'checkSubmission',
        data: {}
      })
  
      if (checkRes.result.code !== 200) {
        // 检查不通过，提示原因并终止
        wx.hideLoading()
        wx.showModal({
          title: '提交失败',
          content: checkRes.result.message,
          showCancel: false
        })
        this.setData({ submitting: false, submitDisabled: false })
        return
      }
  
      // 2. 获取地理位置（若失败则终止）
      let location = null
      try {
        location = await this.getCurrentLocation()
      } catch (locErr) {
        wx.hideLoading()
        wx.showToast({ title: locErr.message || '位置获取失败', icon: 'none' })
        this.setData({ submitting: false, submitDisabled: false })
        return
      }
  
      // 3. 上传跑步截图
      const runningTempPath = this.data.images[0]
      const runningCloudPath = `running-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
      const runningUploadRes = await wx.cloud.uploadFile({
        cloudPath: runningCloudPath,
        filePath: runningTempPath
      })
      const fileID = runningUploadRes.fileID
      uploadedFileIDs.push(fileID)
  
      // 4. 若选择“任意场地跑”，上传步数截图
      let stepFileID = ''
      if (this.data.modeIndex === 1) {
        const stepTempPath = this.data.stepImages[0]
        const stepCloudPath = `step-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
        const stepUploadRes = await wx.cloud.uploadFile({
          cloudPath: stepCloudPath,
          filePath: stepTempPath
        })
        stepFileID = stepUploadRes.fileID
        uploadedFileIDs.push(stepFileID)
      }
  
      // 5. 调用正式提交的云函数
      const mode = this.data.modeOptions[this.data.modeIndex]
      const res = await wx.cloud.callFunction({
        name: 'uploadRunningRecordBasic',
        data: {
          fileID,
          stepFileID,
          mode,
          coordinates: location
        }
      })
  
      wx.hideLoading()
  
      // 6. 处理云函数返回结果
      switch (res.result.code) {
        case 200:
          // 提交成功，清空表单
          this.setData({
            images: [],
            stepImages: [],
            currentLocation: null
          })
          wx.showToast({ icon: 'success', title: '提交成功' })
          break
        case 500:
        default:
          // 提交失败，删除已上传的图片
          if (uploadedFileIDs.length > 0) {
            wx.cloud.deleteFile({
              fileList: uploadedFileIDs,
              success: (delRes) => console.log('已删除无效图片', delRes),
              fail: (delErr) => console.error('删除失败', delErr)
            })
          }
          if (res.result.code === 500) {
            wx.showModal({
              title: '提交失败',
              content: '服务器内部错误，请稍后重试',
              showCancel: false
            })
          }
      }
    } catch (error) {
      console.error('提交过程异常:', error)
      wx.hideLoading()
      // 若有已上传文件，尝试删除（防止异常后残留）
      if (uploadedFileIDs && uploadedFileIDs.length) {
        wx.cloud.deleteFile({ fileList: uploadedFileIDs })
      }
      wx.showToast({
        title: error.message || '网络错误，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false, submitDisabled: false })
    }
  }
})