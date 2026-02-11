// pages/appeal-detail/appeal-detail.js
Page({
  data: {
    appeal: {}, // 申诉详情数据
    loading: true, // 加载状态
    runningRecord: {} // 关联的跑步记录
  },

  onLoad(options) {
    // 从页面参数中获取申诉ID
    const id = options.id;
    if (id) {
      // 加载申诉详情
      this.loadAppealDetail(id);
    } else {
      // 没有ID参数，返回上一页
      wx.showToast({
        title: '加载失败：没有申诉ID',
        icon: 'none'
      });
      setTimeout(() => {
        this.goBack();
      }, 1500);
    }
  },

  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  loadAppealDetail(id) {
    this.setData({
      loading: true
    });

    const db = wx.cloud.database();
    
    // 先加载申诉详情
    db.collection('Appeals')
      .doc(id)
      .get()
      .then(res => {
        const appealData = res.data;
        
        // 检查是否获取到数据
        if (!appealData) {
          this.setData({
            loading: false
          });
          wx.showToast({
            title: '加载详情失败：未找到申诉记录',
            icon: 'none'
          });
          setTimeout(() => {
            this.goBack();
          }, 1500);
          return;
        }
        
        // 处理申诉状态和时间
        let statusText = '正在申诉中'
        let statusClass = 'status-pending'
        
        if (appealData.status === 1) {
          statusText = '记录通过'
          statusClass = 'status-success'
        } else if (appealData.status === 2) {
          statusText = '记录未通过'
          statusClass = 'status-failed'
        }
        
        // 处理时间显示
        const createTime = appealData.createTime ? new Date(appealData.createTime) : new Date()
        const formattedCreateTime = createTime.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
        
        const auditTime = appealData.auditTime ? new Date(appealData.auditTime) : null
        const formattedAuditTime = auditTime ? auditTime.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : ''
        
        // 处理后的申诉数据
        const processedAppeal = {
          ...appealData,
          statusText: statusText,
          statusClass: statusClass,
          formattedCreateTime: formattedCreateTime,
          formattedAuditTime: formattedAuditTime
        }
        
        this.setData({
          appeal: processedAppeal
        });
        
        // 加载关联的跑步记录
        this.loadRunningRecord(appealData.runningRecordId);
      })
      .catch(error => {
        this.setData({
          loading: false
        });
        wx.showToast({
          title: '加载详情失败',
          icon: 'none'
        });
      });
  },

  /**
   * 加载关联的跑步记录
   */
  loadRunningRecord(runningRecordId) {
    const db = wx.cloud.database();
    db.collection('RunningRecords')
      .doc(runningRecordId)
      .get()
      .then(res => {
        const recordData = res.data;
        
        if (recordData) {
          // 确保status字段为数字类型
          if (recordData.status !== undefined) {
            recordData.status = parseInt(recordData.status);
          }
          
          // 处理未通过原因显示
          if (recordData.audit_reason) {
            let reason = recordData.audit_reason.toLowerCase();
            if (reason.includes('ocr') || reason.includes('识别')) {
              recordData.displayAuditReason = '学号和姓名不匹配';
            } else {
              recordData.displayAuditReason = recordData.audit_reason;
            }
          } else {
            recordData.displayAuditReason = '未提供具体原因';
          }
          
          this.setData({
            runningRecord: recordData
          });
        }
        
        this.setData({
          loading: false
        });
      })
      .catch(error => {
        this.setData({
          loading: false
        });
      });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const appealImages = this.data.appeal.appealImages;
    if (appealImages && appealImages.length > 0) {
      wx.previewImage({
        current: appealImages[index],
        urls: appealImages
      });
    }
  },

  /**
   * 查看跑步记录详情
   */
  viewRunningRecord() {
    const runningRecordId = this.data.appeal.runningRecordId;
    if (runningRecordId) {
      wx.navigateTo({
        url: `/pages/record-detail/record-detail?id=${runningRecordId}`
      });
    }
  }
})
