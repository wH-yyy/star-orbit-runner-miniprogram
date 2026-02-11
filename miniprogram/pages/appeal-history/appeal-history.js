// pages/appeal-history/appeal-history.js
Page({
  data: {
    appealList: [],
    loading: true,
  },

  onLoad() {
    this.loadAppealHistory()
  },

  onShow() {
    this.setData({
      appealList: [],
      loading: true,
    })
    this.loadAppealHistory()
  },

  onPullDownRefresh() {
    this.setData({
      appealList: [],
      loading: true,
    })
    this.loadAppealHistory()
    wx.stopPullDownRefresh()
  },

  loadAppealHistory() {
    this.setData({
      loading: true
    })

    const app = getApp()
    const openid = app.globalData.userInfo.openid

    const db = wx.cloud.database()
    db.collection('Appeals')
      .where({
        openid: openid
      })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const appealData = res.data
        
        // 处理申诉状态和时间
        const processedAppeals = appealData.map(item => {
          // 处理状态显示
          let statusText = '正在申诉中'
          let statusClass = 'status-pending'
          
          if (item.status === 1) {
            statusText = '申诉被接受'
            statusClass = 'status-success'
          } else if (item.status === 2) {
            statusText = '申诉被驳回'
            statusClass = 'status-failed'
          }
          
          // 处理时间显示
          const createTime = item.createTime ? new Date(item.createTime) : new Date()          
          // 格式化日期和时间
          const formattedDate = createTime.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
          
          const formattedTime = createTime.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })
          
          return {
            ...item,
            statusText,
            statusClass,
            formattedTime,
            formattedDate,
          }
        })
        
        this.setData({
          appealList: processedAppeals,
          loading: false
        })
      })
      .catch(error => {
        this.setData({
          loading: false
        })
        wx.showToast({
          title: '加载申诉历史失败',
          icon: 'none'
        })
      })
  },

  viewRecordDetail(e) {
    const index = e.currentTarget.dataset.index
    const recordId = this.data.appealList[index].runningRecordId
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?recordId=${recordId}`
    })
  },
})
