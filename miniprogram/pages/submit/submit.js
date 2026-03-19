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
    pendIngReason: '',

    // 活动信息
    activityInfo: {
      semester: '',
      startDate: '',
      endDate: '',
      startTime: 20,
      endTime: 22.5,
      timeRange: '20:00~22:30'
    }
  },

  getTimeRange() {
    const { startTime, endTime } = this.data.activityInfo;
    const format = (num) => {
      const hour = Math.floor(num);
      const minute = Math.round((num - hour) * 60);
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    };
    return `${format(startTime)}~${format(endTime)}`;
  },

  async onLoad() {
    if (!getApp().globalData.userInfo.campus || !getApp().globalData.userInfo.class_name || !getApp().globalData.userInfo.college || !getApp().globalData.userInfo.gender || !getApp().globalData.userInfo.name) {
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
    await this.loadActivityInfo()
    this.checkSubmissionAvailability()
  },

  async onShow() {
    await this.loadActivityInfo()
    this.checkSubmissionAvailability()
  },

  // 加载活动信息
  async loadActivityInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCurrentActivity'
      })
      
      if (res.result.code === 200) {
        const activityInfo = res.result.data
        // 格式化日期显示
        const startDate = this.formatDateDisplay(activityInfo.start_date)
        const endDate = this.formatDateDisplay(activityInfo.end_date)
        
        this.setData({
          activityInfo: {
            semester: activityInfo.semester,
            startDate: startDate,
            endDate: endDate,
            startTime: activityInfo.start_time,
            endTime: activityInfo.end_time,
            timeRange: this.getTimeRange()
          }
        })
      } else {
        console.error('获取活动信息失败:', res.result.message)
        // 如果获取失败，使用默认值
        this.setData({
          activityInfo: {
            semester: '当前无活动',
            startDate: '',
            endDate: '',
            startTime: 20,
            endTime: 22.5,
            timeRange: '20:00~22:30'
          }
        })
      }
    } catch (error) {
      console.error('加载活动信息失败:', error)
      // 如果发生错误，使用默认值
      this.setData({
        activityInfo: {
          semester: '加载失败',
          startDate: '',
          endDate: '',
          startTime: 20,
          endTime: 22.5,
          timeRange: '20:00~22:30'
        }
      })
    }
  },

  // 格式化日期显示（YYYY-MM-DD 转换为 M月D日）
  formatDateDisplay(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  },

  // 检查提交可用性
  async checkSubmissionAvailability() {
    const app = getApp()
    // 完善个人信息检查
    if (!app.globalData.userInfo.class_name || !app.globalData.userInfo.college || !app.globalData.userInfo.gender || !app.globalData.userInfo.name || !app.globalData.userInfo.campus) {
      wx.showToast({
        icon: 'error',
        title: '请完善个人信息',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/finish-info/finish-info',
        })
      }, 1500)
    }

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
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = this.data.activityInfo.startTime * 60
    const endMinutes = this.data.activityInfo.endTime * 60
    console.log(startMinutes)
    console.log(endMinutes)
    console.log(currentMinutes)
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      this.setData({ submitDisabled: true, submitTextIndex: 1 })
      return
    }

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
      wx.showToast({
        icon: 'error',
        title: '请上传跑步截图'
      })
      return
    }
    if (this.data.modeIndex === 1 && (!this.data.stepImages || this.data.stepImages.length === 0)) {
      wx.showToast({
        icon: 'error',
        title: '请上传步数截图'
      })
      return
    }

    let uploadedFileIDs = []
    try {
      wx.showLoading({
        title: '提交中',
        mask: true
      })
      this.setData({
        submitting: true,
        submitDisabled: true
      })

      // 1. 获取地理位置（若失败则终止）
      let location = null
      try {
        location = await this.getCurrentLocation()
      } catch (locErr) {
        wx.hideLoading()
        wx.showToast({
          title: locErr.message || '位置获取失败',
          icon: 'none'
        })
        this.setData({
          submitting: false,
          submitDisabled: false
        })
        return
      }

      // 2. 前置检查（调用 checkSubmission 云函数，传递定位信息）
      const checkRes = await wx.cloud.callFunction({
        name: 'checkSubmission',
        data: {
          coordinates: {
            latitude: location.latitude,
            longitude: location.longitude
          }
        }
      })

      if (checkRes.result.code !== 200) {
        // 检查不通过，提示原因并终止
        wx.hideLoading()
        wx.showModal({
          title: '提交失败',
          content: checkRes.result.message,
          showCancel: false
        })
        this.setData({
          submitting: false,
          submitDisabled: false
        })
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
        name: 'uploadRunningRecord',
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
          wx.showToast({
            icon: 'success',
            title: '提交成功'
          })
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
          wx.showModal({
            title: '提交失败',
            content: `错误码${res.result.code}，请稍后重试`,
            showCancel: false
          })
      }
    } catch (error) {
      console.error('提交过程异常:', error)
      wx.hideLoading()
      // 若有已上传文件，尝试删除（防止异常后残留）
      if (uploadedFileIDs && uploadedFileIDs.length) {
        wx.cloud.deleteFile({
          fileList: uploadedFileIDs
        })
      }
      wx.showToast({
        title: error.message || '网络错误，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({
        submitting: false,
        submitDisabled: false
      })
    }
  }
})