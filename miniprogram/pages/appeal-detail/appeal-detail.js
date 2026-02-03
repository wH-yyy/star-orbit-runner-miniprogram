// pages/appeal-detail/appeal-detail.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    appeal: {}, // 申诉详情数据
    loading: true, // 加载状态
    runningRecord: {} // 关联的跑步记录
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 从页面参数中获取申诉ID
    const id = options.id;
    console.log('=== 申诉详情页面加载，获取到的申诉ID:', id);
    if (id) {
      // 加载申诉详情
      this.loadAppealDetail(id);
    } else {
      // 没有ID参数，返回上一页
      console.error('=== 申诉详情页面加载失败：没有获取到申诉ID');
      wx.showToast({
        title: '加载失败：没有申诉ID',
        icon: 'none'
      });
      setTimeout(() => {
        this.goBack();
      }, 1500);
    }
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  /**
   * 加载申诉详情
   */
  loadAppealDetail(id) {
    console.log('=== 开始加载申诉详情，ID:', id);
    this.setData({
      loading: true
    });

    const db = wx.cloud.database();
    
    // 先加载申诉详情
    db.collection('Appeals')
      .doc(id)
      .get()
      .then(res => {
        console.log('=== 加载申诉详情成功，结果:', res);
        const appealData = res.data;
        
        // 检查是否获取到数据
        if (!appealData) {
          console.error('=== 加载申诉详情失败：未获取到数据');
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
        let statusText = '待处理'
        let statusClass = 'status-pending'
        
        if (appealData.status === 1) {
          statusText = '申诉成功'
          statusClass = 'status-success'
        } else if (appealData.status === 2) {
          statusText = '申诉失败'
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
        console.error('=== 加载申诉详情失败:', error);
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
    console.log('=== 开始加载关联的跑步记录，ID:', runningRecordId);
    
    const db = wx.cloud.database();
    db.collection('RunningRecords')
      .doc(runningRecordId)
      .get()
      .then(res => {
        console.log('=== 加载关联跑步记录成功，结果:', res);
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
        console.error('=== 加载关联跑步记录失败:', error);
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
