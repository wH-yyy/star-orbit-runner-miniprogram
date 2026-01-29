// pages/submit/submit.js
Page({
  data: {
    date: '',
    dateError: false,
    dateErrorMsg: '',

    // 图片（用于预览展示：临时路径）
    images: [],
    // 与 images 一一对应的云存储 fileID
    imageFileIDs: [],
    maxImages: 1,
    imageError: false,
    imageErrorMsg: '',

    // 跑步方式选择
    // 这里文本可按你实际需要调整
    modeOptions: ['全程在操场/在操场跑四圈', '在任意场地跑，提供步数截图'],
    modeIndex: 0,

    // 提交状态
    submitting: false,
    submitDisabled: false,
    submitText: "提交审核",

    // 成功弹窗
    showSuccess: false
  },

  onLoad() {
    // 默认展示当前时间（仅展示用；实际审核以OCR识别到的时间为准）
    this.setData({
      date: this.formatNow()
    })
  },

  onShow() {
    // 每次进入提交页时刷新一次当前时间，避免长时间打开小程序后时间不更新
    this.setData({
      date: this.formatNow()
    })
  },

  formatNow() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${hh}:${mm}`
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

      wx.showLoading({ title: '上传中...', mask: true })
      this.setData({ submitDisabled: true, submitText: '上传中...' })

      for (const f of tempFiles) {
        const tempFilePath = f.tempFilePath
        const cloudPath = `running-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePath
        })

        this.setData({
          images: [...this.data.images, tempFilePath],
          imageFileIDs: [...this.data.imageFileIDs, uploadRes.fileID],
          imageError: false,
          imageErrorMsg: ''
        })
      }
    } catch (error) {
      console.error('选择/上传图片失败:', error)
      if (error && error.errMsg && error.errMsg.includes('cancel')) return
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      if (!this.data.submitting) {
        this.setData({ submitDisabled: false, submitText: '提交审核' })
      }
    }
  },

  deleteImage(e) {
    if (this.data.submitting) return
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    const images = [...this.data.images]
    const imageFileIDs = [...this.data.imageFileIDs]
    images.splice(index, 1)
    imageFileIDs.splice(index, 1)

    this.setData({ images, imageFileIDs })
  },

  validateForm() {
    let ok = true

    if (!this.data.imageFileIDs || this.data.imageFileIDs.length === 0) {
      ok = false
      this.setData({
        imageError: true,
        imageErrorMsg: '请上传跑步记录截图'
      })
    } else {
      this.setData({
        imageError: false,
        imageErrorMsg: ''
      })
    }

    return ok
  },

  async submitForm() {
    if (this.data.submitting) return
    if (!this.validateForm()) return

    if (!wx.cloud) {
      wx.showModal({
        title: '错误',
        content: '云开发未初始化，请检查app.js中的wx.cloud.init',
        showCancel: false
      })
      return
    }

    const fileID = this.data.imageFileIDs[0]
    const mode = this.data.modeOptions[this.data.modeIndex] || ''

    try {
      this.setData({
        submitting: true,
        submitDisabled: true,
        submitText: '审核中...'
      })
      wx.showLoading({ title: '审核中...', mask: true })

      const res = await wx.cloud.callFunction({
        name: 'uploadRunningRecord',
        // 目前云函数还未使用 mode，如需存库可以后续在云函数中接收并写入
        data: { fileID, mode }
      })

      wx.hideLoading()

      const result = res && res.result ? res.result : null
      if (!result) {
        wx.showToast({ title: '提交失败', icon: 'none' })
        return
      }

      // uploadRunningRecord 约定：{ code, message, data }
      if (result.code !== 200) {
        wx.showModal({
          title: '提交失败',
          content: result.message || '提交失败，请稍后重试',
          showCancel: false
        })
        return
      }

      const auditStatus = result.data ? result.data.auditStatus : ''
      const auditReason = result.data ? result.data.auditReason : ''

      if (auditStatus === '1') {
        // 审核通过：清空已选图片与错误提示，再展示成功弹窗
        this.setData({
          images: [],
          imageFileIDs: [],
          imageError: false,
          imageErrorMsg: '',
          showSuccess: true
        })
      } else {
        // 审核不通过：同样清空已选图片，避免残留
        this.setData({
          images: [],
          imageFileIDs: [],
          imageError: false,
          imageErrorMsg: ''
        })
        wx.showModal({
          title: '审核未通过',
          content: auditReason || '不符合打卡规则',
          showCancel: false,
          success: () => {
            // 仍然已入库，返回记录页查看详情
            wx.navigateBack({ delta: 1 })
          }
        })
      }
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

  onSuccessClose() {
    this.setData({ showSuccess: false })
    wx.navigateBack({ delta: 1 })
  },

  preventTouchMove() {}
})