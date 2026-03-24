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
      startTime: 0,
      endTime: 0,
      timeRange: '00:00~00:00'
    }
  },

  getTimeRange(startTime, endTime) {
    const format = (num) => {
      const hour = Math.floor(num);
      const minute = Math.round((num - hour) * 60);
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    };
    return `${format(startTime)}~${format(endTime)}`;
  },

  async onLoad() {
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
        const startTime = activityInfo.start_time;
        const endTime = activityInfo.end_time;
  
        const timeRange = this.getTimeRange(startTime, endTime);
  
        this.setData({
          activityInfo: {
            semester: activityInfo.semester,
            startDate,
            endDate,
            startTime,
            endTime,
            timeRange
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
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      this.setData({
        submitDisabled: true,
        submitTextIndex: 1
      })
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

  async submitForm() {
    if (this.data.submitting) return

    const app = getApp()
    // 登录检查
    if (!app.globalData.userInfo.openid) {
      wx.showToast({
        icon: 'error',
        title: '请先登录',
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login',
        })
      }, 1000)
      return
    }
    // 完善个人信息检查
    if (!app.globalData.userInfo.class_name || !app.globalData.userInfo.college || !app.globalData.userInfo.gender || !app.globalData.userInfo.name || !app.globalData.userInfo.campus) {
      wx.showToast({
        icon: 'error',
        title: '请完善个人信息',
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/finish-info/finish-info',
        })
      }, 1000)
      return
    }

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

      // 准备上传参数
      const runningTempPath = this.data.images[0]
      const runningCloudPath = `running-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`

      let stepTempPath = null
      let stepCloudPath = null
      if (this.data.modeIndex === 1) {
        stepTempPath = this.data.stepImages[0]
        stepCloudPath = `step-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
      }

      // 并行执行：获取位置 + 上传跑步截图 + (如果需要)上传步数截图
      const tasks = [
        this.getCurrentLocation(),
        wx.cloud.uploadFile({
          cloudPath: runningCloudPath,
          filePath: runningTempPath
        })
      ]
      if (stepTempPath) {
        tasks.push(wx.cloud.uploadFile({
          cloudPath: stepCloudPath,
          filePath: stepTempPath
        }))
      }

      const results = await Promise.all(tasks)
      const location = results[0]
      const runningUploadRes = results[1]
      const fileID = runningUploadRes.fileID
      uploadedFileIDs.push(fileID)

      let stepFileID = ''
      if (stepTempPath) {
        const stepUploadRes = results[2]
        stepFileID = stepUploadRes.fileID
        uploadedFileIDs.push(stepFileID)
      }

      // 调用合并后的云函数
      const mode = this.data.modeOptions[this.data.modeIndex]
      const res = await wx.cloud.callFunction({
        name: 'submitRunningRecord',
        data: {
          fileID,
          stepFileID,
          mode,
          coordinates: location
        }
      })

      wx.hideLoading()

      // 处理返回结果
      switch (res.result.code) {
        case 200:
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
        case 403:
        case 405:
        case 402:
        case 401:
        case 406:
          wx.showModal({
            title: '提交失败',
            content: res.result.message,
            showCancel: false
          })
          if (uploadedFileIDs.length) {
            wx.cloud.deleteFile({
              fileList: uploadedFileIDs
            })
          }
      }
    } catch (error) {
      console.error('提交过程异常:', error)
      wx.hideLoading()
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