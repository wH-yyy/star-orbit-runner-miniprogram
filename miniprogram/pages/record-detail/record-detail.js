Page({
  data: {
    record: {}, // 记录详情数据
    appeal: null, // 申诉详情数据
    loading: true, // 加载状态
    appealReason: '', // 申诉理由
    uploadedImages: [], // 已上传图片列表
    showAppealModal: false // 申诉模态框显示状态
  },

  onLoad(options) {
    const index = options.index
    if (index) {
      const pages = getCurrentPages()
      const prevPage = pages[pages.length - 2]
      if (prevPage && prevPage.data) {
        const record = prevPage.data.displayedRecords[index]
        this.setData({ 
          record,
          loading: false
        })
      }
      this.loadAppealDetail(this.data.record._id)
    } else {
      wx.showToast({
        title: '加载失败：没有记录索引',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        });
      }, 1500);
    }
  },

  loadAppealDetail(recordId) {
    const db = wx.cloud.database();
    db.collection('Appeals')
      .where({
        runningRecordId: recordId
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const appealData = res.data[0];
          this.processAppealData(appealData);
        }
      })
      .catch(error => {
        console.error('加载申诉详情失败:', error);
      });
  },

  processAppealData(appealData) {
    let statusText = '申诉中';
    let statusClass = 'status-pending';
    
    if (appealData.status === 1) {
      statusText = '申诉被接受';
      statusClass = 'status-success';
    } else if (appealData.status === 2) {
      statusText = '申诉被驳回';
      statusClass = 'status-failed';
    }
    
    // 处理时间显示
    const createTime = appealData.createTime ? new Date(appealData.createTime) : new Date();
    const formattedCreateTime = createTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const auditTime = appealData.auditTime ? new Date(appealData.auditTime) : null;
    const formattedAuditTime = auditTime ? auditTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';
    
    // 处理后的申诉数据
    const processedAppeal = {
      ...appealData,
      statusText: statusText,
      statusClass: statusClass,
      formattedCreateTime: formattedCreateTime,
      formattedAuditTime: formattedAuditTime
    };
    
    this.setData({
      appeal: processedAppeal
    });
  },

  previewImage(e) {
    const imageFileID = this.data.record.imageFileID;
    if (imageFileID) {
      wx.previewImage({
        current: imageFileID,
        urls: [imageFileID]
      });
    }
  },

  /**
   * 预览申诉图片
   */
  previewAppealImage(e) {
    const index = e.currentTarget.dataset.index;
    const appealImages = this.data.appeal?.appealImages;
    if (appealImages && appealImages.length > 0) {
      wx.previewImage({
        current: appealImages[index],
        urls: appealImages
      });
    }
  },

  /**
   * 显示申诉模态框
   */
  showAppealModal() {
    // 只有状态为2（不通过）且不在申诉中状态下才能申诉
    if (this.data.record.status === 2) {
      this.setData({
        showAppealModal: true
      });
    } else if (this.data.record.status === 3) {
      wx.showToast({
        title: '该记录已在申诉中，请等待审核',
        icon: 'none',
        duration: 2000
      });
    } else {
      wx.showToast({
        title: '只有不通过的记录才能申诉',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 隐藏申诉模态框
   */
  hideAppealModal() {
    if (this.data.appealReason.trim() || this.data.uploadedImages.length > 0) {
      wx.showModal({
        title: '确认取消',
        content: '您的申诉内容尚未提交，确定要取消吗？',
        confirmText: '确定取消',
        cancelText: '继续编辑',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              showAppealModal: false,
              appealReason: '',
              uploadedImages: []
            });
          }
        }
      });
    } else {
      this.setData({
        showAppealModal: false
      });
    }
  },

  /**
   * 申诉理由输入处理
   */
  onAppealReasonInput(e) {
    this.setData({
      appealReason: e.detail.value
    });
  },

  /**
   * 上传图片
   */
  uploadImage() {
    const that = this;
    wx.chooseImage({
      count: 5 - that.data.uploadedImages.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        // 临时文件路径
        const tempFilePaths = res.tempFilePaths;
        
        wx.showLoading({
          title: '图片上传中...',
          mask: true
        });
        
        // 实际上传图片到云存储
        const uploadTasks = tempFilePaths.map((tempFilePath, index) => {
          const fileName = `appeals/${getApp().globalData.userInfo.openid}_${Date.now()}_${index}.jpg`;
          return wx.cloud.uploadFile({
            cloudPath: fileName,
            filePath: tempFilePath
          });
        });
        
        Promise.all(uploadTasks)
          .then(uploadResults => {
            wx.hideLoading();
            // 获取上传成功的FileID
            const fileIDs = uploadResults.map(result => result.fileID);
            // 将FileID添加到已上传列表
            that.setData({
              uploadedImages: [...that.data.uploadedImages, ...fileIDs]
            }, () => {
              wx.showToast({
                title: '图片上传成功',
                icon: 'success',
                duration: 1000
              });
            });
          })
          .catch(error => {
            wx.hideLoading();
            console.error('图片上传失败:', error);
            wx.showToast({
              title: '图片上传失败',
              icon: 'none'
            });
          });
      },
      fail(err) {
        if (err.errMsg !== 'chooseImage:fail cancel') {
          wx.showToast({
            title: '图片选择失败',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * 删除图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const uploadedImages = [...this.data.uploadedImages];
    uploadedImages.splice(index, 1);
    this.setData({
      uploadedImages: uploadedImages
    });
  },

  /**
   * 提交申诉
   */
  submitAppeal() {
    const { appealReason, uploadedImages, record } = this.data;
    
    // 表单验证
    if (!appealReason.trim()) {
      wx.showToast({
        title: '请输入申诉理由',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认申诉',
      content: '确定要提交申诉吗？提交后将重新审核您的跑步记录。',
      confirmText: '确认提交',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '申诉提交中...',
            mask: true
          });
          
          // 调用云函数提交申诉
          wx.cloud.callFunction({
            name: 'submitAppeal',
            data: {
              runningRecordId: record._id,
              appealReason: appealReason.trim(),
              appealImages: uploadedImages
            }
          })
          .then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              wx.showToast({
                title: res.result.message || '申诉已提交，正在重新审核',
                icon: 'success',
                duration: 2000
              });
              
              // 申诉成功后更新状态为申诉中（3）
              this.setData({
                record: {
                  ...record,
                  status: 3
                },
                showAppealModal: false,
                appealReason: '',
                uploadedImages: []
              });
              
              // 重新加载申诉详情
              this.loadAppealDetail(record._id);
            } else {
              wx.showToast({
                title: res.result.message || '申诉提交失败，请稍后重试',
                icon: 'none',
                duration: 2000
              });
            }
          })
          .catch(error => {
            wx.hideLoading();
            console.error('申诉提交失败:', error);
            wx.showToast({
              title: '网络错误，请稍后重试',
              icon: 'none',
              duration: 2000
            });
          });
        }
      }
    });
  }
});