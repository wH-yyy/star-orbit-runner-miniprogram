// pages/appeal-history/appeal-history.js
Page({
  data: {
    appealList: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad() {
    this.loadAppealHistory()
  },

  onShow() {
    this.setData({
      appealList: [],
      loading: true,
      hasMore: true,
      page: 1
    })
    this.loadAppealHistory()
    console.log(this.data.appealList)
  },

  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadMoreAppeals()
    }
  },

  onPullDownRefresh() {
    this.setData({
      appealList: [],
      loading: true,
      hasMore: true,
      page: 1
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

    if (!openid) {
      this.setData({
        loading: false
      })
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/phone-login/phone-login'
        })
      }, 1500)
      return
    }

    const db = wx.cloud.database()
    const skip = (this.data.page - 1) * this.data.pageSize

    console.log('准备查询Appeals表，条件:', { openid: openid })
    db.collection('Appeals')
      .where({
        openid: openid
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        const appealData = res.data
        
        // 处理申诉状态和时间
        const processedAppeals = appealData.map(item => {
          // 处理状态显示
          let statusText = '正在申诉中'
          let statusClass = 'status-pending'
          
          if (item.status === 1) {
            statusText = '记录通过'
            statusClass = 'status-success'
          } else if (item.status === 2) {
            statusText = '记录未通过'
            statusClass = 'status-failed'
          }
          
          // 处理时间显示
          const createTime = item.createTime ? new Date(item.createTime) : new Date()
          const formattedTime = createTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
          
          // 格式化日期和时间
          const formattedDate = createTime.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
          
          const formattedTimeOnly = createTime.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })
          
          return {
            ...item,
            statusText: statusText,
            statusClass: statusClass,
            formattedTime: formattedTime,
            formattedDate: formattedDate,
            formattedTimeOnly: formattedTimeOnly
          }
        })
        
        let newAppealList = []
        if (this.data.page === 1) {
          newAppealList = processedAppeals
        } else {
          newAppealList = [...this.data.appealList, ...processedAppeals]
        }
        
        this.setData({
          appealList: newAppealList,
          hasMore: processedAppeals.length === this.data.pageSize,
          loading: false
        })
        console.log(this.data.appealList)
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

  /**
   * 加载更多申诉记录
   */
  loadMoreAppeals() {
    if (this.data.loading || !this.data.hasMore) {
      return
    }
    
    this.setData({
      loading: true,
      page: this.data.page + 1
    })
    
    this.loadAppealHistory()
  },

  viewRecordDetail(e) {
    const index = e.currentTarget.dataset.index
    const recordId = this.data.appealList[index].runningRecordId
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?recordId=${recordId}`
    })
  },
})
