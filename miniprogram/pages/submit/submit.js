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
    submitTextIndex: 4,
    submitTextList: ['提交', '未到提交时间', '今日停跑', '已被禁跑', ''],

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
        submitTextIndex: 3,
        isBanned: true,
        banRemainingDays: app.globalData.userInfo.ban_remaining_days
      })
      return
    }

    // 停跑日检查
    try {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}`

      const db = wx.cloud.database()
      const restDaysCollection = db.collection('rest_days')
      const res = await restDaysCollection.where({
        date: todayStr
      }).get()

      if (res.data.length > 0) {
        this.setData({
          submitDisabled: true,
          submitTextIndex: 2,
          isPending: true,
          pendIngReason: res.data[0].reason
        })
        return
      }
    } catch (err) {
      console.error('检查停跑日失败:', err)
      wx.showModal({
        title: '提示',
        content: '停跑检查失败，暂不可提交，请稍后重试。',
        showCancel: false,
        confirmText: '确定'
      })
      this.setData({
        submitDisabled: true,
        submitTextIndex: 2
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
          currentLocation: locationData,
          locationError: false,
          locationErrorMsg: ''
        })
        resolve(locationData)
      },
      fail: (err) => {
        this.setData({
          locationError: true,
          locationErrorMsg: '获取位置失败，请检查位置权限或网络连接'
        })
        reject(new Error('获取位置失败'))
      }
    })
  },

  // 提交表单
  async submitForm() {
    if (this.data.submitting) return

    // 前端基础校验
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

    try {
      this.setData({
        submitting: true,
        submitDisabled: true
      })

      // 1. 获取地理位置
      let location = null
      try {
        location = await this.getCurrentLocation()
      } catch (locErr) {
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

      wx.showLoading({
        title: '上传中...',
        mask: true
      })

      // 2. 上传跑步截图
      const runningTempPath = this.data.images[0]
      const runningCloudPath = `running-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
      const runningUploadRes = await wx.cloud.uploadFile({
        cloudPath: runningCloudPath,
        filePath: runningTempPath
      })
      const fileID = runningUploadRes.fileID

      // 3. 若选择“任意场地跑”，上传步数截图
      let stepFileID = ''
      if (this.data.modeIndex === 1) {
        const stepTempPath = this.data.stepImages[0]
        const stepCloudPath = `step-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
        const stepUploadRes = await wx.cloud.uploadFile({
          cloudPath: stepCloudPath,
          filePath: stepTempPath
        })
        stepFileID = stepUploadRes.fileID
      }

      // 4. 调用云函数写入记录
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
      
      // 5. 处理云函数返回结果
      switch (res.result.code) {
        case 200:
          // 提交成功，清空表单
          this.setData({
            images: [],
            stepImages: [],
            currentLocation: null
          });
          wx.showToast({
            icon: 'success',
            title: '提交成功'
          });
          break;
        case 400:
          wx.showToast({
            title: '请勿重复提交',
            icon: 'error'
          });
          break;
        case 500:
          wx.showModal({
            title: '提交失败',
            content: '错误码：500',
            showCancel: false
          });
          break;
      }
    } catch (error) {
      console.error('提交过程异常:', error)
      wx.hideLoading()
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