Page({
  data: {
    recordId: '',// 记录ID
    record: {},// 记录数据
    newImageTempPath: '',// 新图片临时路径
    newStepImageTempPath: '',// 新步数截图临时路径
    submitting: false,//是否提交中
    modeOptions: ['全程在操场，在操场跑四圈', '在任意场地跑，提供步数截图'],// 模式选项
    modeIndex: 0,// 当前模式索引
    originalMode: '',// 原始模式
    dropdownOpen: false// 下拉菜单是否打开
  },
  // 页面加载
  onLoad(options) {
    const { recordId } = options
    if (!recordId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
      return
    }

    this.setData({ recordId })
    this.loadRecord(recordId)
  },
  // 加载记录
  async loadRecord(recordId) {
    wx.showLoading({ title: '加载中...' })

    try {
      const db = wx.cloud.database()
      const res = await db.collection('RunningRecords').doc(recordId).get()
      const record = res.data

      if (!record) {
        throw new Error('记录不存在')
      }
      // 格式化时间
      if (record.create_time) {
        const createTime = new Date(record.create_time)
        const year = createTime.getFullYear()
        const month = String(createTime.getMonth() + 1).padStart(2, '0')
        const day = String(createTime.getDate()).padStart(2, '0')
        const hours = String(createTime.getHours()).padStart(2, '0')
        const minutes = String(createTime.getMinutes()).padStart(2, '0')
        const seconds = String(createTime.getSeconds()).padStart(2, '0')
        record.create_date = `${year}-${month}-${day}`
        record.create_time_24 = `${hours}:${minutes}:${seconds}`
      }

      // 匹配模式
      const modeOptions = this.data.modeOptions
      const recordMode = record.mode || modeOptions[0]
      const matchedIndex = modeOptions.indexOf(recordMode)
      const modeIndex = matchedIndex >= 0 ? matchedIndex : 0

      this.setData({
        record,
        modeIndex,
        originalMode: recordMode
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
    } finally {
      wx.hideLoading()
    }
  },
  // 选择新图片
  chooseNewImage() {
    if (this.data.submitting) return

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFiles = res.tempFiles || []
        if (!tempFiles.length) return

        this.setData({
          newImageTempPath: tempFiles[0].tempFilePath
        })
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('cancel')) return

        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },
  // 选择新步数截图
  chooseNewStepImage() {
    if (this.data.submitting) return

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFiles = res.tempFiles || []
        if (!tempFiles.length) return

        this.setData({
          newStepImageTempPath: tempFiles[0].tempFilePath
        })
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('cancel')) return

        wx.showToast({
          title: '选择步数截图失败',
          icon: 'none'
        })
      }
    })
  },

  toggleDropdown() {
    if (this.data.submitting) return

    this.setData({
      dropdownOpen: !this.data.dropdownOpen
    })
  },
  // 切换下拉菜单
  selectMode(e) {
    if (this.data.submitting) return

    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    this.setData({
      modeIndex: index,
      dropdownOpen: false
    })
  },
  // 返回
  goBack() {
    if (this.data.submitting) return
    wx.navigateBack()
  },
  // 提交新图片
  async submitNewImage() {
    if (this.data.submitting) return

    const {
      recordId,
      newImageTempPath,
      newStepImageTempPath,
      modeOptions,
      modeIndex,
      originalMode,
      record
    } = this.data

    const selectedMode = modeOptions[modeIndex]
    const modeChanged = selectedMode !== originalMode
    const imageChanged = !!newImageTempPath
    const stepImageChanged = !!newStepImageTempPath
    const needsStepImage = selectedMode === modeOptions[1]
    // 检查是否有修改
    if (!imageChanged && !modeChanged && !stepImageChanged) {
      wx.showToast({
        title: '请先做出修改',
        icon: 'none'
      })
      return
    }
    // 检查步数截图
    if (needsStepImage && !record.stepImageFileID && !stepImageChanged) {
      wx.showToast({
        title: '请上传步数截图',
        icon: 'none'
      })
      return
    }

    let uploadedFileIDs = []

    try {
      wx.showLoading({
        title: '提交中...',
        mask: true
      })

      this.setData({ submitting: true })

      let finalImageFileID = ''
      let finalStepImageFileID = ''
       // 上传新图片
      if (imageChanged) {
        const suffix = newImageTempPath.split('.').pop() || 'jpg'
        const cloudPath = `running-records/${Date.now()}_${Math.random().toString(16).slice(2)}.${suffix}`

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: newImageTempPath
        })

        finalImageFileID = uploadRes.fileID
        uploadedFileIDs.push(finalImageFileID)
      }
      // 上传新步数截图
      if (needsStepImage && stepImageChanged) {
        const suffix = newStepImageTempPath.split('.').pop() || 'jpg'
        const cloudPath = `step-records/${Date.now()}_${Math.random().toString(16).slice(2)}.${suffix}`

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: newStepImageTempPath
        })

        finalStepImageFileID = uploadRes.fileID
        uploadedFileIDs.push(finalStepImageFileID)
      }
      // 调用云函数更新记录
      const funcRes = await wx.cloud.callFunction({
        name: 'updateRunningRecordImage',
        data: {
          recordId,
          newImageFileID: finalImageFileID,
          newStepImageFileID: needsStepImage ? finalStepImageFileID : '',
          newMode: selectedMode
        }
      })

      wx.hideLoading()

      if (funcRes.result.code !== 200) {
        if (uploadedFileIDs.length) {
          wx.cloud.deleteFile({
            fileList: uploadedFileIDs
          })
        }

        wx.showModal({
          title: '修改失败',
          content: funcRes.result.message || '请稍后重试',
          showCancel: false
        })
        return
      }

      wx.showToast({
        title: '修改成功',
        icon: 'success'
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 800)
    } catch (error) {
      console.error('submitNewImage error:', error)
      wx.hideLoading()

      if (uploadedFileIDs.length) {
        wx.cloud.deleteFile({
          fileList: uploadedFileIDs
        })
      }

      wx.showToast({
        title: '修改失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
